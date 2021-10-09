import { nameFunction } from './functionName';

export interface MyCallback<Argument extends unknown[]> {
	displayName?: string;

	(...param: Argument): void | undefined | boolean;
}

/**
 * Manage a list of callback
 */
export class CallbackList<Argument extends unknown[]> {
	protected list: MyCallback<Argument>[] = [];
	protected running: boolean = false;

	constructor() {
		this.run = (this.run as any).bind(this);
	}

	count() {
		return this.list.length;
	}

	reset() {
		if (this.running) {
			throw new Error("Can not reset when it's running.");
		}
		this.list.length = 0;
	}

	/**
	 * @param name optional name of `item` (will assign displayName to `item`)
	 * @returns function list length
	 */
	add(item: MyCallback<Argument>, name?: string): number {
		if (this.running) {
			throw new Error("Can not add callback when it's running.");
		}
		if (name) {
			nameFunction(name, item);
		}
		return this.list.push(item);
	}

	/**
	 * @returns if removed: return `item`; if did not exists: return null
	 */
	remove(item: MyCallback<Argument>): null | MyCallback<Argument> {
		if (this.running) {
			throw new Error("Can not remove callback when it's running.");
		}
		const found = this.list.indexOf(item);
		if (found !== -1) {
			return this.list.splice(found, 1)[0];
		}
		return null;
	}

	/**
	 * Stop run if one callback return `true`
	 * @returns {boolean} true if one callback return true
	 */
	run(...argument: Argument): boolean {
		this.running = true;
		const ret = this.list.some((cb) => {
			const ret = cb(...argument);
			return ret === undefined || ret;
		});
		this.running = false;
		return ret;
	}
}
