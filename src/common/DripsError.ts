/* eslint-disable max-classes-per-file */

export enum DripsErrorCode {
	INVALID_ADDRESS = 'INVALID_ADDRESS',
	INVALID_ARGUMENT = 'INVALID_ARGUMENT',
	MISSING_ARGUMENT = 'MISSING_ARGUMENT',
	UNSUPPORTED_NETWORK = 'UNSUPPORTED_NETWORK',
	SUBGRAPH_QUERY_ERROR = 'SUBGRAPH_QUERY_ERROR',
	INVALID_DRIPS_RECEIVER = 'INVALID_DRIPS_RECEIVER',
	INVALID_SPLITS_RECEIVER = 'INVALID_SPLITS_RECEIVER'
}

export class DripsError extends Error {
	public readonly context?: unknown;
	public readonly code: DripsErrorCode;

	constructor(code: DripsErrorCode, message: string, context?: unknown) {
		super(message);

		this.code = code;
		this.context = context;
	}
}

export class DripsErrors {
	static addressError = (message: string, address: string) =>
		new DripsError(DripsErrorCode.INVALID_ADDRESS, message, {
			invalidAddress: address
		});

	static argumentMissingError = (message: string, argName: string) =>
		new DripsError(DripsErrorCode.MISSING_ARGUMENT, message, {
			missingArgumentName: argName
		});

	static unsupportedNetworkError = (message: string, chainId: number) =>
		new DripsError(DripsErrorCode.UNSUPPORTED_NETWORK, message, {
			unsupportedChainId: chainId
		});

	static argumentError = (message: string, argName: string, argValue: unknown) =>
		new DripsError(DripsErrorCode.INVALID_ARGUMENT, message, {
			invalidArgument: { name: argName, value: argValue }
		});

	static splitsReceiverError = (message: string, invalidPropertyName: string, invalidPropertyValue: unknown) =>
		new DripsError(DripsErrorCode.INVALID_SPLITS_RECEIVER, message, {
			invalidProperty: {
				name: invalidPropertyName,
				value: invalidPropertyValue
			}
		});

	static dripsReceiverError = (message: string, invalidPropertyName: string, invalidPropertyValue: unknown) =>
		new DripsError(DripsErrorCode.INVALID_DRIPS_RECEIVER, message, {
			invalidProperty: {
				name: invalidPropertyName,
				value: invalidPropertyValue
			}
		});

	static subgraphQueryError = (message: string) => new DripsError(DripsErrorCode.SUBGRAPH_QUERY_ERROR, message);
}