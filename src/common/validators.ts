import type { JsonRpcProvider } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { DripsErrors } from './DripsError';
import { isNullOrUndefined, nameOf } from './internals';
import type { DripsReceiverConfig, SplitsReceiverStruct } from './types';

const MAX_DRIPS_RECEIVERS = 100;
const MAX_SPLITS_RECEIVERS = 200;

/** @internal */
export const validateAddress = (address: string) => {
	if (!ethers.utils.isAddress(address)) {
		throw DripsErrors.addressError(`Address validation failed: address '${address}' is not valid.`, address);
	}
};

/** @internal */
export const validateDripsReceiverConfig = (dripsReceiverConfig: DripsReceiverConfig): void => {
	if (!dripsReceiverConfig) {
		throw DripsErrors.argumentMissingError(
			`Drips receiver config validation failed: '${nameOf({ dripsReceiverConfig })}' is missing.`,
			nameOf({ dripsReceiverConfig })
		);
	}

	const { dripId, start, duration, amountPerSec } = dripsReceiverConfig;

	if (isNullOrUndefined(dripId) || dripId < 0) {
		throw DripsErrors.dripsReceiverConfigError(
			`Drips receiver config validation failed: '${nameOf({ dripId })}' must be greater than or equal to 0`,
			nameOf({ start }),
			start
		);
	}

	if (isNullOrUndefined(start) || start < 0) {
		throw DripsErrors.dripsReceiverConfigError(
			`Drips receiver config validation failed: '${nameOf({ start })}' must be greater than or equal to 0`,
			nameOf({ start }),
			start
		);
	}

	if (isNullOrUndefined(duration) || duration < 0) {
		throw DripsErrors.dripsReceiverConfigError(
			`Drips receiver config validation failed: '${nameOf({ duration })}' must be greater than or equal to 0`,
			nameOf({ duration }),
			duration
		);
	}

	if (isNullOrUndefined(amountPerSec) || amountPerSec <= 0) {
		throw DripsErrors.dripsReceiverConfigError(
			`Drips receiver config validation failed: '${nameOf({ amountPerSec })}' must be greater than 0.`,
			nameOf({ amountPerSec }),
			amountPerSec
		);
	}
};

/** @internal */
export const validateDripsReceivers = (receivers: { userId: string; config: DripsReceiverConfig }[]) => {
	if (!receivers) {
		throw DripsErrors.argumentMissingError(
			`Drips receivers validation failed: '${nameOf({ receivers })}' is missing.`,
			nameOf({ receivers })
		);
	}

	if (receivers.length > MAX_DRIPS_RECEIVERS) {
		throw DripsErrors.argumentError(
			`Drips receivers validation failed: max number of drips receivers exceeded. Max allowed ${MAX_DRIPS_RECEIVERS} but were ${receivers.length}.`,
			nameOf({ receivers }),
			receivers
		);
	}

	if (receivers.length) {
		receivers.forEach((receiver) => {
			const { userId, config } = receiver;

			if (isNullOrUndefined(userId)) {
				throw DripsErrors.dripsReceiverError(
					`Drips receivers validation failed: '${nameOf({ userId })}' is missing.`,
					nameOf({ userId }),
					userId
				);
			}
			if (isNullOrUndefined(config)) {
				throw DripsErrors.dripsReceiverError(
					`Drips receivers validation failed: '${nameOf({ config })}' is missing.`,
					nameOf({ config }),
					config
				);
			}

			validateDripsReceiverConfig(config);
		});
	}
};

/** @internal */
export const validateSplitsReceivers = (receivers: SplitsReceiverStruct[]) => {
	if (!receivers) {
		throw DripsErrors.argumentMissingError(
			`Splits receivers validation failed: '${nameOf({ receivers })}' is missing.`,
			nameOf({ receivers })
		);
	}

	if (receivers.length > MAX_SPLITS_RECEIVERS) {
		throw DripsErrors.argumentError(
			`Splits receivers validation failed: max number of drips receivers exceeded. Max allowed ${MAX_SPLITS_RECEIVERS} but were ${receivers.length}.`,
			nameOf({ receivers }),
			receivers
		);
	}

	if (receivers.length) {
		receivers.forEach((receiver) => {
			const { userId, weight } = receiver;

			if (!userId) {
				throw DripsErrors.splitsReceiverError(
					`Splits receivers validation failed: '${nameOf({ userId })}' is missing.`,
					nameOf({ userId }),
					userId
				);
			}

			if (isNullOrUndefined(weight)) {
				throw DripsErrors.splitsReceiverError(
					`Splits receivers validation failed: '${nameOf({ weight })}' is missing.`,
					nameOf({ weight }),
					weight
				);
			}

			if (weight <= 0) {
				throw DripsErrors.splitsReceiverError(
					`Splits receiver config validation failed: : '${nameOf({ weight })}' must be greater than 0.`,
					nameOf({ weight }),
					weight
				);
			}
		});
	}
};

/** @internal */
export const validateClientProvider = async (provider: JsonRpcProvider, supportedChains: readonly number[]) => {
	if (!provider) {
		throw DripsErrors.validationError(`'${nameOf({ provider })}' is missing.`, nameOf({ provider }), provider);
	}

	const signer = provider.getSigner();
	const signerAddress = await signer?.getAddress();
	if (!signerAddress) {
		throw DripsErrors.validationError(
			`'${nameOf({ signerAddress })}' is missing.`,
			nameOf({ signerAddress }),
			signerAddress
		);
	}

	validateAddress(signerAddress);

	const network = await provider.getNetwork();
	if (!supportedChains.includes(network?.chainId)) {
		throw DripsErrors.unsupportedNetworkError(
			`The provider is connected to an unsupported network (name: '${network?.name}', chain ID: ${network?.chainId}). Supported chains are: ${supportedChains}.`,
			network?.chainId
		);
	}
};
