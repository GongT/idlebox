import { OutputChannel, window } from 'vscode';
import { BaseLogger } from './logger';

/** @internal */
export const ignoreSymbol = Symbol('ignore');

export class VSCodeChannelLogger extends BaseLogger {
	private declare output: OutputChannel;

	constructor(title: string);
	/** @internal */
	constructor(title: symbol);

	constructor(title: symbol | string) {
		super(title !== ignoreSymbol);
		if (title !== ignoreSymbol) {
			this.setTitle(title as string);
		}
	}

	/** @internal */
	setTitle(title: string) {
		if (this.output) {
			throw new Error('call logger::setTitle multiple times');
		}
		this.output = window.createOutputChannel(title);
		this.output.show(false);
	}

	dispose() {
		return this.output.dispose();
	}

	protected appendLine(line: string): void {
		this.output.appendLine(line);
	}

	public show() {
		this.output.show(false);
	}
}
