import type { JsonRpcSigner } from '@ethersproject/providers';
import { Contract, utils } from 'ethers';
import type { SplitsReceiverStruct } from '../contracts/AddressApp';
import { DripsErrors } from './DripsError';
import type { DripsReceiver, NetworkProperties } from './types';

export const chainIdToNetworkPropertiesMap: Record<number, NetworkProperties> = {
	5: {
		name: 'goerli',
		CONTRACT_DRIPS_HUB: '0x4FaAB6032dd0264a8e2671F56fd30F69362f31Ad',
		CONTRACT_ADDRESS_APP: '0x76F457CD4F60c0a634781bfdB8c5318050633A08',
		CONTRACT_DRIPS_HUB_LOGIC: '0xB79663c5E27C1a2c93aeE2a35b273b0255638267'
	}
};

export const supportedChainIds: readonly number[] = Object.freeze(
	Object.keys(chainIdToNetworkPropertiesMap).map((chainId) => parseInt(chainId, 10))
);

export const guardAgainstInvalidAddress = (...addresses: string[]) => {
	if (!addresses) {
		throw DripsErrors.invalidAddress(`'${addresses}' is not a valid addresses object.`);
	}

	addresses?.forEach((address) => {
		if (!utils.isAddress(address)) {
			throw DripsErrors.invalidAddress(`Address '${address}' is not valid.`);
		}
	});
};

export const guardAgainstInvalidDripsReceiver = (...receivers: DripsReceiver[]) => {
	receivers?.forEach((receiver) => {
		if (!receiver.userId || !receiver.config?.amountPerSec) {
			throw DripsErrors.invalidDripsReceiver(
				`Drips receiver '${JSON.stringify(
					receiver
				)}' is not valid. A receiver must have a user ID and an amountPerSec > 0.`
			);
		}
	});
};

export const guardAgainstInvalidSplitsReceiver = (...receivers: SplitsReceiverStruct[]) => {
	receivers?.forEach((receiver) => {
		if (!receiver.userId || !receiver.weight) {
			throw DripsErrors.invalidSplitsReceiver(
				`Splits receiver '${JSON.stringify(
					receiver
				)}' is not valid. A receiver must have a user ID, an amountPerSec > 0`
			);
		}
	});
};

// All ERC20 tokens implement the same (IERC20) interface.
// The Drips SDK needs only a subset of this interface, the `approve` and `allowance` functions.
export const erc20Abi = [
	{
		inputs: [
			{
				internalType: 'address',
				name: 'owner',
				type: 'address'
			},
			{
				internalType: 'address',
				name: 'spender',
				type: 'address'
			}
		],
		name: 'allowance',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256'
			}
		],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'spender',
				type: 'address'
			},
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256'
			}
		],
		name: 'approve',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool'
			}
		],
		stateMutability: 'nonpayable',
		type: 'function'
	}
];

export const createErc20Contract = (erc20Address: string, signer: JsonRpcSigner): Contract =>
	new Contract(erc20Address, erc20Abi, signer);