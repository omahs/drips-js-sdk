import type { Network } from '@ethersproject/networks';
import type { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import type { ImmutableSplitsDriver, SplitsReceiverStruct, UserMetadataStruct } from 'contracts/ImmutableSplitsDriver';
import type { ContractTransaction } from 'ethers';
import type { DripsMetadata } from 'src/common/types';
import { ImmutableSplitsDriver__factory } from '../../contracts/factories/ImmutableSplitsDriver__factory';
import Utils from '../utils';
import { DripsErrors } from '../common/DripsError';
import { nameOf, validateAddress, validateSplitsReceivers } from '../common/internals';

/**
 * A client for creating immutable splits configurations.
 * Anybody can create a new user ID and configure its splits configuration,
 * but nobody can update its configuration afterwards, it's immutable.
 * @see {@link https://github.com/radicle-dev/drips-contracts/blob/master/src/NFTDriver.sol NFTDriver} smart contract.
 */
export default class ImmutableSplitsDriverClient {
	#immutableSplitsDriverContract!: ImmutableSplitsDriver;

	#signer!: JsonRpcSigner;
	/**
	 * Returns the `ImmutableSplitsDriverClient`'s `signer`.
	 *
	 * This is the owner of the NFT (or someone that is approved to use it) that controls the user to which the `ImmutableSplitsDriverClient` is linked and manages Drips.
	 *
	 * The `signer` is the `provider`'s signer.
	 */
	public get signer(): JsonRpcSigner {
		return this.#signer;
	}

	#signerAddress!: string;
	/** Returns the `ImmutableSplitsDriverClient`'s `signer` address. */
	public get signerAddress(): string {
		return this.#signerAddress;
	}

	#network!: Network;
	/**
	 * Returns the network the `ImmutableSplitsDriverClient` is connected to.
	 *
	 * The `network` is the `provider`'s network.
	 */
	public get network() {
		return this.#network;
	}

	#provider!: JsonRpcProvider;
	/** Returns the `ImmutableSplitsDriverClient`'s `provider`. */
	public get provider(): JsonRpcProvider {
		return this.#provider;
	}

	#dripsMetadata!: DripsMetadata;
	/** Returns the `ImmutableSplitsDriverClient`'s `network` {@link DripsMetadata}. */
	public get dripsMetadata() {
		return this.#dripsMetadata;
	}

	private constructor() {}

	// TODO: Update the supported chains documentation comments.
	/**
	 * Creates a new immutable instance of an `ImmutableSplitsDriverClient`.
	 * @param  {JsonRpcProvider} provider The `provider` must have a `signer` associated with it and can connect to the following supported networks:
	 * - 'goerli': chain ID 5
	 * @returns A `Promise` which resolves to the new `ImmutableSplitsDriverClient` instance.
	 * @throws {DripsErrors.argumentMissingError} if the `provider` is missing.
	 * @throws {DripsErrors.argumentError} if the `provider`'s singer is missing.
	 * @throws {DripsErrors.addressError} if the `provider`'s signer address is not valid.
	 * @throws {DripsErrors.unsupportedNetworkError} if the `provider` is connected to an unsupported network.
	 */
	public static async create(provider: JsonRpcProvider): Promise<ImmutableSplitsDriverClient> {
		if (!provider) {
			throw DripsErrors.argumentMissingError(
				"Could not create a new 'ImmutableSplitsDriverClient': the provider is missing.",
				nameOf({ provider })
			);
		}

		const signer = provider.getSigner();
		const signerAddress = await signer?.getAddress();
		if (!signerAddress) {
			throw DripsErrors.argumentError(
				"Could not create a new 'ImmutableSplitsDriverClient': the provider's signer address is missing.",
				nameOf({ provider }),
				provider
			);
		}
		validateAddress(signerAddress);

		const network = await provider.getNetwork();
		if (!Utils.Network.isSupportedChain(network?.chainId)) {
			throw DripsErrors.unsupportedNetworkError(
				`Could not create a new 'ImmutableSplitsDriverClient': the provider is connected to an unsupported network (name: '${
					network?.name
				}', chain ID: ${network?.chainId}). Supported chains are: ${Utils.Network.SUPPORTED_CHAINS.toString()}.`,
				network?.chainId
			);
		}
		const dripsMetadata = Utils.Network.dripsMetadata[network.chainId];

		const immutableSplitsDriverClient = new ImmutableSplitsDriverClient();

		immutableSplitsDriverClient.#signer = signer;
		immutableSplitsDriverClient.#network = network;
		immutableSplitsDriverClient.#provider = provider;
		immutableSplitsDriverClient.#dripsMetadata = dripsMetadata;
		immutableSplitsDriverClient.#signerAddress = await signer.getAddress();
		immutableSplitsDriverClient.#immutableSplitsDriverContract = ImmutableSplitsDriver__factory.connect(
			dripsMetadata.CONTRACT_IMMUTABLE_SPLITS_DRIVER,
			signer
		);

		return immutableSplitsDriverClient;
	}

	/**
	 * Creates a new user ID, configures its splits configuration and emits its metadata.
	 * The configuration is immutable and nobody can control the user ID after its creation.
	 * Calling this function is the only way and the only chance to emit metadata for that user.
	 * @param  {SplitsReceiverStruct[]} receivers The splits receivers.
	 * @param  {UserMetadataStruct[]} metadata The list of user metadata to emit for the created user.
	 * The key and the value are _not_ standardized by the protocol, it's up to the user to establish and follow conventions to ensure compatibility with the consumers.
	 * @returns A `Promise` which resolves to the `ContractTransaction`.
	 * @throws {DripsErrors.argumentMissingError} if the `receivers` are missing.
	 * @throws {DripsErrors.splitsReceiverError} if any of the `receivers` is not valid.
	 */
	public async createSplits(
		receivers: SplitsReceiverStruct[],
		metadata: UserMetadataStruct[]
	): Promise<ContractTransaction> {
		validateSplitsReceivers(receivers);

		if (!metadata) {
			throw DripsErrors.argumentMissingError(
				`Could not create immutable splits: '${nameOf({ receivers })}' is missing.`,
				nameOf({ receivers })
			);
		}

		return this.#immutableSplitsDriverContract.createSplits(receivers, metadata);
	}
}