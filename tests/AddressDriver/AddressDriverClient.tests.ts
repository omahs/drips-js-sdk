import type { StubbedInstance } from 'ts-sinon';
import sinon, { stubObject, stubInterface } from 'ts-sinon';
import { assert } from 'chai';
import { JsonRpcSigner, JsonRpcProvider } from '@ethersproject/providers';
import type { Network } from '@ethersproject/networks';
import type { BigNumberish } from 'ethers';
import { ethers, BigNumber, constants, Wallet } from 'ethers';
import type { AddressDriver, IERC20 } from '../../contracts';
import { IERC20__factory, AddressDriver__factory } from '../../contracts';
import type { SplitsReceiverStruct, DripsReceiverStruct, AddressDriverInterface } from '../../contracts/AddressDriver';
import AddressDriverClient from '../../src/AddressDriver/AddressDriverClient';
import Utils from '../../src/utils';
import { DripsErrorCode } from '../../src/common/DripsError';
import * as validators from '../../src/common/validators';
import DripsHubClient from '../../src/DripsHub/DripsHubClient';
import type { DripsReceiver } from '../../src/common/types';
import CallerClient from '../../src/Caller/CallerClient';

describe('AddressDriverClient', () => {
	const TEST_CHAIN_ID = 5; // Goerli.

	let networkStub: StubbedInstance<Network>;
	let signerStub: StubbedInstance<JsonRpcSigner>;
	let providerStub: StubbedInstance<JsonRpcProvider>;
	let callerClientStub: StubbedInstance<CallerClient>;
	let dripsHubClientStub: StubbedInstance<DripsHubClient>;
	let addressDriverContractStub: StubbedInstance<AddressDriver>;
	let addressDriverInterfaceStub: StubbedInstance<AddressDriverInterface>;

	let testAddressDriverClient: AddressDriverClient;

	// Acts also as the "base Arrange step".
	beforeEach(async () => {
		providerStub = sinon.createStubInstance(JsonRpcProvider);

		signerStub = sinon.createStubInstance(JsonRpcSigner);
		signerStub.getAddress.resolves(Wallet.createRandom().address);

		networkStub = stubObject<Network>({ chainId: TEST_CHAIN_ID } as Network);

		providerStub.getSigner.returns(signerStub);
		providerStub.getNetwork.resolves(networkStub);

		addressDriverContractStub = stubInterface<AddressDriver>();
		addressDriverInterfaceStub = stubInterface<AddressDriverInterface>();
		addressDriverContractStub.interface = addressDriverInterfaceStub;

		sinon
			.stub(AddressDriver__factory, 'connect')
			.withArgs(Utils.Network.configs[TEST_CHAIN_ID].CONTRACT_ADDRESS_DRIVER, signerStub)
			.returns(addressDriverContractStub);

		dripsHubClientStub = stubInterface<DripsHubClient>();
		sinon.stub(DripsHubClient, 'create').resolves(dripsHubClientStub);

		callerClientStub = stubInterface<CallerClient>();
		sinon.stub(CallerClient, 'create').resolves(callerClientStub);

		testAddressDriverClient = await AddressDriverClient.create(providerStub);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('create()', () => {
		it('should validate the provider', async () => {
			// Arrange
			const validateClientProviderStub = sinon.stub(validators, 'validateClientProvider');

			// Act
			AddressDriverClient.create(providerStub);

			// Assert
			assert(
				validateClientProviderStub.calledOnceWithExactly(providerStub, Utils.Network.SUPPORTED_CHAINS),
				'Expected method to be called with different arguments'
			);
		});

		it('should set the custom driver address when provided', async () => {
			// Arrange
			const customDriverAddress = Wallet.createRandom().address;

			// Act
			const client = await AddressDriverClient.create(providerStub, customDriverAddress);

			// Assert
			assert.equal(client.driverAddress, customDriverAddress);
		});

		it('should create a fully initialized client instance', async () => {
			// Assert
			assert.equal(testAddressDriverClient.provider, providerStub);
			assert.equal(testAddressDriverClient.provider.getSigner(), providerStub.getSigner());
			assert.equal(
				await testAddressDriverClient.provider.getSigner().getAddress(),
				await providerStub.getSigner().getAddress()
			);
			assert.equal(
				testAddressDriverClient.driverAddress,
				Utils.Network.configs[(await providerStub.getNetwork()).chainId].CONTRACT_ADDRESS_DRIVER
			);
		});
	});

	describe('getAllowance()', () => {
		it('should validate the ERC20 address', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const validateAddressStub = sinon.stub(validators, 'validateAddress');

			const erc20ContractStub = stubInterface<IERC20>();

			erc20ContractStub.allowance
				.withArgs(await signerStub.getAddress(), testAddressDriverClient.driverAddress)
				.resolves(BigNumber.from(1));

			sinon
				.stub(IERC20__factory, 'connect')
				.withArgs(tokenAddress, testAddressDriverClient.provider.getSigner())
				.returns(erc20ContractStub);

			// Act
			await testAddressDriverClient.getAllowance(tokenAddress);

			// Assert
			assert(validateAddressStub.calledOnceWithExactly(tokenAddress));
		});

		it('should call the getAllowance() method of the ERC20 contract', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;

			const erc20ContractStub = stubInterface<IERC20>();

			erc20ContractStub.allowance
				.withArgs(await signerStub.getAddress(), testAddressDriverClient.driverAddress)
				.resolves(BigNumber.from(1));

			sinon
				.stub(IERC20__factory, 'connect')
				.withArgs(tokenAddress, testAddressDriverClient.provider.getSigner())
				.returns(erc20ContractStub);

			// Act
			const allowance = await testAddressDriverClient.getAllowance(tokenAddress);

			// Assert
			assert.equal(allowance, 1n);
			assert(
				erc20ContractStub.allowance.calledOnceWithExactly(
					await testAddressDriverClient.provider.getSigner().getAddress(),
					testAddressDriverClient.driverAddress
				),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('approve()', () => {
		it('should validate the ERC20 address', async () => {
			// Arrange
			const tokenAddress = 'invalid address';
			const validateAddressStub = sinon.stub(validators, 'validateAddress');

			const erc20ContractStub = stubInterface<IERC20>();

			sinon
				.stub(IERC20__factory, 'connect')
				.withArgs(tokenAddress, testAddressDriverClient.provider.getSigner())
				.returns(erc20ContractStub);

			// Act
			await testAddressDriverClient.approve(tokenAddress);

			// Assert
			assert(validateAddressStub.calledOnceWithExactly(tokenAddress));
		});

		it('should call the approve() method of the ERC20 contract', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;

			const erc20ContractStub = stubInterface<IERC20>();

			sinon
				.stub(IERC20__factory, 'connect')
				.withArgs(tokenAddress, testAddressDriverClient.provider.getSigner())
				.returns(erc20ContractStub);

			// Act
			await testAddressDriverClient.approve(tokenAddress);

			// Assert
			assert(
				erc20ContractStub.approve.calledOnceWithExactly(testAddressDriverClient.driverAddress, constants.MaxUint256),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('getUserId()', () => {
		it('should call the calcUserId() method of the AddressDriver contract', async () => {
			// Arrange
			addressDriverContractStub.calcUserId
				.withArgs(await testAddressDriverClient.provider.getSigner().getAddress())
				.resolves(BigNumber.from(111));

			// Act
			await testAddressDriverClient.getUserId();

			// Assert
			assert(
				addressDriverContractStub.calcUserId.calledOnceWithExactly(
					await testAddressDriverClient.provider.getSigner().getAddress()
				),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('getUserIdByAddress()', () => {
		it('should validate the user address', async () => {
			// Arrange
			const userAddress = Wallet.createRandom().address;
			const validateAddressStub = sinon.stub(validators, 'validateAddress');
			addressDriverContractStub.calcUserId.resolves(BigNumber.from(1));

			// Act
			await testAddressDriverClient.getUserIdByAddress(userAddress);

			// Assert
			assert(validateAddressStub.calledOnceWithExactly(userAddress));
		});

		it('should call the calcUserId() method of the AddressDriver contract', async () => {
			// Arrange
			const userAddress = Wallet.createRandom().address;
			addressDriverContractStub.calcUserId.withArgs(userAddress).resolves(BigNumber.from(111));

			// Act
			await testAddressDriverClient.getUserIdByAddress(userAddress);

			// Assert
			assert(
				addressDriverContractStub.calcUserId.calledOnceWithExactly(userAddress),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('collect()', () => {
		it('should validate the ERC20 and transferTo addresses', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;
			const validateAddressStub = sinon.stub(validators, 'validateAddress');

			// Act
			await testAddressDriverClient.collect(tokenAddress, transferToAddress);

			// Assert
			assert(
				validateAddressStub.calledWithExactly(tokenAddress),
				'Expected method to be called with different arguments'
			);
			assert(
				validateAddressStub.calledWithExactly(transferToAddress),
				'Expected method to be called with different arguments'
			);
		});

		it('should call the collect() method of the AddressDriver contract', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;

			// Act
			await testAddressDriverClient.collect(tokenAddress, transferToAddress);

			// Assert
			assert(
				addressDriverContractStub.collect.calledOnceWithExactly(tokenAddress, transferToAddress),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('give()', () => {
		it('should throw argumentMissingError when receiverUserId is missing', async () => {
			// Arrange
			let threw = false;
			const tokenAddress = Wallet.createRandom().address;

			try {
				// Act
				await testAddressDriverClient.give(undefined as unknown as string, tokenAddress, 1n);
			} catch (error: any) {
				// Assert
				assert.equal(error.code, DripsErrorCode.MISSING_ARGUMENT);
				threw = true;
			}

			// Assert
			assert.isTrue(threw, 'Expected type of exception was not thrown');
		});

		it('should throw argumentMissingError when amount is less than or equal to 0', async () => {
			// Arrange
			let threw = false;
			const tokenAddress = Wallet.createRandom().address;

			try {
				// Act
				await testAddressDriverClient.give('1', tokenAddress, -1n);
			} catch (error: any) {
				// Assert
				assert.equal(error.code, DripsErrorCode.INVALID_ARGUMENT);
				threw = true;
			}

			// Assert
			assert.isTrue(threw, 'Expected type of exception was not thrown');
		});

		it('should validate the ERC20 address', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const validateAddressStub = sinon.stub(validators, 'validateAddress');

			// Act
			await testAddressDriverClient.give('1', tokenAddress, 1n);

			// Assert
			assert(validateAddressStub.calledOnceWithExactly(tokenAddress));
		});

		it('should call the give() method of the AddressDriver contract', async () => {
			// Arrange
			const amount = 100n;
			const receiverUserId = '1';
			const tokenAddress = Wallet.createRandom().address;

			// Act
			await testAddressDriverClient.give(receiverUserId, tokenAddress, amount);

			// Assert
			assert(
				addressDriverContractStub.give.calledOnceWithExactly(receiverUserId, tokenAddress, amount),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('setSplits()', () => {
		it('should throw argumentMissingError when splits receivers are missing', async () => {
			// Arrange
			let threw = false;

			// Act
			try {
				await testAddressDriverClient.setSplits(undefined as unknown as SplitsReceiverStruct[]);
			} catch (error: any) {
				// Assert
				assert.equal(error.code, DripsErrorCode.MISSING_ARGUMENT);
				threw = true;
			}

			// Assert
			assert.isTrue(threw, 'Expected type of exception was not thrown');
		});

		it('clears splits when new receivers is an empty list', async () => {
			// Act
			await testAddressDriverClient.setSplits([]);

			// Assert
			assert(
				addressDriverContractStub.setSplits.calledOnceWithExactly([]),
				'Expected method to be called with different arguments'
			);
		});

		it('should validate the splits receivers', async () => {
			// Arrange
			const receivers: SplitsReceiverStruct[] = [
				{ userId: 1, weight: 1 },
				{ userId: 2, weight: 2 }
			];

			const validateSplitsReceiversStub = sinon.stub(validators, 'validateSplitsReceivers');

			// Act
			await testAddressDriverClient.setSplits(receivers);

			// Assert
			assert(validateSplitsReceiversStub.calledOnceWithExactly(receivers));
		});

		it('should call the setSplits() method of the AddressDriver contract', async () => {
			// Arrange
			const receivers: SplitsReceiverStruct[] = [
				{ userId: 2, weight: 100 },
				{ userId: 1, weight: 1 },
				{ userId: 1, weight: 1 }
			];

			// Act
			await testAddressDriverClient.setSplits(receivers);

			// Assert
			assert(
				addressDriverContractStub.setSplits.calledOnceWithExactly(
					sinon
						.match((r: SplitsReceiverStruct[]) => r.length === 2)
						.and(sinon.match((r: SplitsReceiverStruct[]) => r[0].userId === 1))
						.and(sinon.match((r: SplitsReceiverStruct[]) => r[1].userId === 2))
				),
				'Expected method to be called with different arguments'
			);
		});

		it('should sort by the expected order when userID1>userID2', async () => {
			// Arrange
			const receivers: SplitsReceiverStruct[] = [
				{ userId: 100, weight: 1 },
				{ userId: 1, weight: 100 }
			];

			// Act
			await testAddressDriverClient.setSplits(receivers);

			// Assert
			assert(
				addressDriverContractStub.setSplits.calledOnceWithExactly(
					sinon.match((r: DripsReceiverStruct[]) => r[0].userId < r[1].userId)
				),
				'Expected method to be called with different arguments'
			);
		});

		it('should sort by the expected order when userID1<userID2', async () => {
			// Arrange
			const receivers: SplitsReceiverStruct[] = [
				{ userId: 1, weight: 100 },
				{ userId: 100, weight: 1 }
			];

			// Act
			await testAddressDriverClient.setSplits(receivers);

			// Assert
			assert(
				addressDriverContractStub.setSplits.calledOnceWithExactly(
					sinon.match((r: DripsReceiverStruct[]) => r[0].userId < r[1].userId)
				),
				'Expected method to be called with different arguments'
			);
		});

		it('should remove duplicates', async () => {
			// Arrange
			const receivers: SplitsReceiverStruct[] = [
				{ userId: 1, weight: 100 },
				{ userId: 1, weight: 100 },
				{ userId: 100, weight: 1 }
			];

			// Act
			await testAddressDriverClient.setSplits(receivers);

			// Assert
			assert(
				addressDriverContractStub.setSplits.calledOnceWithExactly(
					sinon.match((r: DripsReceiverStruct[]) => r.length === 2)
				),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('setDrips()', () => {
		it('should validate the ERC20 address', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;
			const currentReceivers: DripsReceiverStruct[] = [
				{
					userId: 3,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 3n, duration: 3n, start: 3n })
				}
			];
			const receivers: DripsReceiverStruct[] = [
				{
					userId: 2,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 1n, duration: 1n, start: 1n })
				},
				{
					userId: 2,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 1n, duration: 1n, start: 1n })
				},
				{
					userId: 1,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 2n, duration: 2n, start: 2n })
				}
			];

			const validateAddressStub = sinon.stub(validators, 'validateAddress');

			// Act
			await testAddressDriverClient.setDrips(tokenAddress, currentReceivers, receivers, transferToAddress, 1n);

			// Assert
			assert(validateAddressStub.calledOnceWithExactly(tokenAddress));
		});

		it('should validate the drips receivers', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;

			const currentReceivers: DripsReceiverStruct[] = [
				{
					userId: '3',
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 3n, duration: 3n, start: 3n })
				}
			];
			const receivers: DripsReceiverStruct[] = [
				{
					userId: '2',
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 1n, duration: 1n, start: 1n })
				},
				{
					userId: '2',
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 1n, duration: 1n, start: 1n })
				},
				{
					userId: '1',
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 2n, duration: 2n, start: 2n })
				}
			];

			const validateDripsReceiversStub = sinon.stub(validators, 'validateDripsReceivers');

			// Act
			await testAddressDriverClient.setDrips(tokenAddress, currentReceivers, receivers, transferToAddress, 1n);

			// Assert
			assert(
				validateDripsReceiversStub.calledWithExactly(
					sinon.match(
						(r: DripsReceiver[]) =>
							r[0].userId === receivers[0].userId &&
							r[1].userId === receivers[1].userId &&
							r[2].userId === receivers[2].userId
					)
				),
				'Expected method to be called with different arguments'
			);
			assert(
				validateDripsReceiversStub.calledWithExactly(
					sinon.match((r: DripsReceiver[]) => r[0].userId === currentReceivers[0].userId)
				),
				'Expected method to be called with different arguments'
			);
		});

		it('should throw argumentMissingError when current drips transferToAddress are missing', async () => {
			// Arrange
			let threw = false;

			// Act
			try {
				await testAddressDriverClient.setDrips(
					Wallet.createRandom().address,
					[],
					[],
					undefined as unknown as string,
					0n
				);
			} catch (error: any) {
				// Assert
				assert.equal(error.code, DripsErrorCode.MISSING_ARGUMENT);
				threw = true;
			}

			// Assert
			assert.isTrue(threw, 'Expected type of exception was not thrown');
		});

		it('should clear drips when new receivers is an empty list', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;
			const currentReceivers: DripsReceiverStruct[] = [
				{
					userId: 3,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 3n, duration: 3n, start: 3n })
				}
			];

			// Act
			await testAddressDriverClient.setDrips(tokenAddress, currentReceivers, [], transferToAddress, 1n);

			// Assert
			assert(
				addressDriverContractStub.setDrips.calledOnceWithExactly(
					tokenAddress,
					currentReceivers,
					1n,
					[],
					transferToAddress
				),
				'Expected method to be called with different arguments'
			);
		});

		it('should call the setDrips() method of the AddressDriver contract', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;
			const currentReceivers: DripsReceiverStruct[] = [
				{
					userId: 3n,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 3n, duration: 3n, start: 3n })
				}
			];
			const receivers: DripsReceiverStruct[] = [
				{
					userId: 2n,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 1n, duration: 1n, start: 1n })
				},
				{
					userId: 2n,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 1n, duration: 1n, start: 1n })
				},
				{
					userId: 1n,
					config: Utils.DripsReceiverConfiguration.toUint256({ dripId: 1n, amountPerSec: 2n, duration: 2n, start: 2n })
				}
			];

			// Act
			await testAddressDriverClient.setDrips(tokenAddress, currentReceivers, receivers, transferToAddress, 1n);

			// Assert
			assert(
				addressDriverContractStub.setDrips.calledOnceWithExactly(
					tokenAddress,
					currentReceivers,
					1n,
					sinon
						.match((r: DripsReceiverStruct[]) => r[0].userId === 1n)
						.and(sinon.match((r: DripsReceiverStruct[]) => r[1].userId === 2n))
						.and(sinon.match((r: DripsReceiverStruct[]) => r.length === 2)),
					transferToAddress
				),
				'Expected method to be called with different arguments'
			);
		});

		it('should set default values when required parameters are falsy', async () => {
			// Arrange
			const tokenAddress = Wallet.createRandom().address;
			const transferToAddress = Wallet.createRandom().address;

			// Act
			await testAddressDriverClient.setDrips(tokenAddress, [], [], transferToAddress, undefined as unknown as bigint);

			// Assert
			assert(
				addressDriverContractStub.setDrips.calledOnceWithExactly(tokenAddress, [], 0, [], transferToAddress),
				'Expected method to be called with different arguments'
			);
		});
	});

	describe('getAddressByUserId', () => {
		it('should return the expected result', () => {
			const expectedAddress = '0xAEeF2381C4Ca788a7bc53421849d73e61ec47B8D';
			const userId = '998697365313809816557299962230702436787341785997';

			// Act
			const actualAddress = AddressDriverClient.getUserAddress(userId);

			// Assert
			assert.equal(actualAddress, expectedAddress);
		});
	});

	describe('emitUserMetadata()', () => {
		it('should throw argumentMissingError when key missing', async () => {
			// Arrange
			let threw = false;

			// Act
			try {
				await testAddressDriverClient.emitUserMetadata(undefined as unknown as BigNumberish, 'value');
			} catch (error: any) {
				// Assert
				assert.equal(error.code, DripsErrorCode.MISSING_ARGUMENT);
				threw = true;
			}

			// Assert
			assert.isTrue(threw, 'Expected type of exception was not thrown');
		});

		it('should throw argumentMissingError when value missing', async () => {
			// Arrange
			let threw = false;

			// Act
			try {
				await testAddressDriverClient.emitUserMetadata('key', undefined as unknown as string);
			} catch (error: any) {
				// Assert
				assert.equal(error.code, DripsErrorCode.MISSING_ARGUMENT);
				threw = true;
			}

			// Assert
			assert.isTrue(threw, 'Expected type of exception was not thrown');
		});

		it('should delegate the expected call to the caller', async () => {
			// Arrange
			const key: BigNumberish = '1';
			const value: string = 'value';
			const expectedData = '0x11';

			addressDriverInterfaceStub.encodeFunctionData
				.withArgs(sinon.match('emitUserMetadata'), [key, ethers.utils.hexlify(ethers.utils.toUtf8Bytes(value))])
				.returns(expectedData);

			// Act
			await testAddressDriverClient.emitUserMetadata(key, value);

			// Assert
			assert(addressDriverContractStub.emitUserMetadata.notCalled);
			assert(
				callerClientStub.callBatched.calledOnceWithExactly([
					{
						value: 0,
						to: testAddressDriverClient.driverAddress,
						data: expectedData
					}
				]),
				'Expected method to be called with different arguments'
			);
		});
	});
});
