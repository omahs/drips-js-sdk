import { InfuraProvider } from '@ethersproject/providers';
import { Wallet } from 'ethers';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { assert } from 'chai';
import AddressDriverClient from '../../src/AddressDriver/AddressDriverClient';
import DripsHubClient from '../../src/DripsHub/DripsHubClient';
import Utils from '../../src/utils';
import DripsSubgraphClient from '../../src/DripsSubgraph/DripsSubgraphClient';
import { expect } from '../../src/common/internals';
import type { UserAssetConfig } from '../../src/DripsSubgraph/types';
import constants from '../../src/constants';

dotenv.config();

describe('DripsHubClient integration tests', () => {
	const THREE_MINS = 180000; // In milliseconds.
	const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6';

	it('should squeeze', async () => {
		const provider = new InfuraProvider('goerli');
		const receiverAccount = process.env.ACCOUNT_1 as string;
		const senderAccount = process.env.ACCOUNT_2 as string;

		const senderAccountAsSigner = new Wallet(process.env.ACCOUNT_2_SECRET_KEY as string);

		const senderAddressDriverClient = await AddressDriverClient.create(provider, senderAccountAsSigner);
		const subgraphClient = DripsSubgraphClient.create((await provider.getNetwork()).chainId);
		const dripsHubClient = await DripsHubClient.create(provider, senderAccountAsSigner);

		const senderUserId = await senderAddressDriverClient.getUserId();
		const receiverUserId = await senderAddressDriverClient.getUserIdByAddress(receiverAccount);

		const receiverAddressDriverClient = await AddressDriverClient.create(
			provider,
			new Wallet(process.env.ACCOUNT_1_SECRET_KEY as string)
		);
		await receiverAddressDriverClient.approve(WETH);

		console.log(
			`Will squeeze WETH (${WETH}) funds for ${receiverAccount} (user ID ${receiverUserId}) from ${senderAccount} (user ID: ${senderUserId}).`
		);

		console.log(`Squeezing funds to set receiver's squeezable balance to 0...`);
		const argsBefore = await subgraphClient.getArgsForSqueezingAllDrips(receiverUserId, senderUserId, WETH);
		await dripsHubClient.squeezeDrips(
			argsBefore.userId,
			argsBefore.tokenAddress,
			argsBefore.senderId,
			argsBefore.historyHash,
			argsBefore.dripsHistory
		);

		console.log("Querying the Subgraph until receiver's squeezable balance is 0...");
		const squeezableBalanceBefore = (await expect(
			async () =>
				dripsHubClient.getSqueezableBalance(
					argsBefore.userId,
					argsBefore.tokenAddress,
					argsBefore.senderId,
					argsBefore.historyHash,
					argsBefore.dripsHistory
				),
			(balance) => {
				const found = balance === 0n;

				if (!found) {
					console.log(`Expected squeezable amount to be 0 but was ${balance}.`);
				} else {
					console.log(`Expected squeezable amount is ${balance}!`);
				}
				return found;
			},
			60000,
			5000
		)) as bigint;

		assert.equal(squeezableBalanceBefore, 0n);

		console.log(`Will update WETH (${WETH}) Drips configuration for ${senderAccount} (user ID: ${senderUserId}).`);

		const wEthConfigurationBefore = await subgraphClient.getUserAssetConfigById(
			senderUserId,
			Utils.Asset.getIdFromAddress(WETH)
		);
		console.log(
			`Current WETH Drips configuration has the following receivers: ${
				wEthConfigurationBefore?.dripsEntries.length
					? wEthConfigurationBefore?.dripsEntries.map((d) => `id: ${d.id}, userId: ${d.userId}, config: ${d.config}`)
					: '[no receivers or no configuration found]'
			}`
		);

		const config = Utils.DripsReceiverConfiguration.toUint256({
			start: BigInt(0),
			duration: BigInt(0),
			amountPerSec: BigInt(1 * constants.AMT_PER_SEC_MULTIPLIER),
			dripId: BigInt(Math.floor(Math.random() * 1_000_000_000))
		});

		console.log(`Updating Drips configuration...`);
		await senderAddressDriverClient.setDrips(
			WETH,
			wEthConfigurationBefore?.dripsEntries.map((d) => ({
				config: d.config,
				userId: d.userId
			})) || [],
			[{ config, userId: receiverUserId }],
			senderAccount,
			'10000000000000000' // 0.01 ETH
		);

		console.log(`Querying the Subgraph until the new WETH Drips configuration is the expected...`);
		const expectedConfig = (await expect(
			() => subgraphClient.getUserAssetConfigById(senderUserId, Utils.Asset.getIdFromAddress(WETH)),
			(configuration) => {
				const found =
					configuration?.dripsEntries.length === 1 &&
					configuration.dripsEntries[0].config === config &&
					configuration.dripsEntries[0].userId === receiverUserId;

				if (!found) {
					console.log('New Drips configuration not found yet.');
				} else {
					console.log('New Drips configuration found!');
				}

				return found;
			},
			60000,
			5000
		)) as UserAssetConfig;

		assert.equal(expectedConfig.dripsEntries[0].userId, receiverUserId);

		console.log("Querying the Subgraph until receiver's squeezable balance is greater than 0...");
		const argsAfter = await subgraphClient.getArgsForSqueezingAllDrips(receiverUserId, senderUserId, WETH);
		const squeezableBalanceAfter = (await expect(
			async () =>
				dripsHubClient.getSqueezableBalance(
					argsAfter.userId,
					argsAfter.tokenAddress,
					argsAfter.senderId,
					argsAfter.historyHash,
					argsAfter.dripsHistory
				),
			(balance) => {
				const found = balance > 0;

				if (!found) {
					console.log(`Expected squeezable balance to be greater than 0 but was ${balance}`);
				} else {
					console.log(`Squeezable balance greater than 0 found (${balance})!`);
				}

				return found;
			},
			60000,
			5000
		)) as bigint;

		assert.isTrue(squeezableBalanceAfter > 0);

		console.log(`Clearing WETH configuration receivers to stop dripping...`);
		await senderAddressDriverClient.setDrips(
			WETH,
			expectedConfig.dripsEntries.map((d) => ({
				config: d.config,
				userId: d.userId
			})),
			[],
			senderAccount
		);
		console.log(`Done.`);
	}).timeout(THREE_MINS);
});
