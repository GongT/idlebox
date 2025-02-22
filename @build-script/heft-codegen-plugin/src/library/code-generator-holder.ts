import { wrapLogger, type IOutputShim } from '@build-script/heft-plugin-base';
import { PromisePool } from '@supercharge/promise-pool';
import { basename, isAbsolute, resolve } from 'path';
import { CodeGenerator } from './code-generator.js';
import { ExecuteReason } from './shared.js';

export interface IResult {
	/**
	 * all generator.ts files count
	 */
	count: number;
	/**
	 * how many generator.ts files will be executed
	 */
	schedule: number;
	/**
	 * count success write out
	 */
	success: number;
	/**
	 * count unchanged
	 */
	skip: number;
	/**
	 * count and detail failed execute
	 */
	errors: Error[];
	/**
	 * readed files
	 */
	watchFiles: readonly string[];
}

function nextTick() {
	return new Promise((resolve) => {
		process.nextTick(resolve);
	});
}

export class GeneratorHolder {
	private readonly generators = new Map<string, CodeGenerator>();

	constructor(
		private readonly logger: IOutputShim,
		private readonly root: string,
	) {}

	async makeGenerators(files: string[], standalone: boolean) {
		this.logger.debug(`register generator:`);
		const used = new Set<string>();
		for (const file of files) {
			const abs = resolve(this.root, file);
			used.add(abs);

			if (this.generators.has(abs)) {
				this.logger.debug(`  - ${abs}`);
				continue;
			}
			this.logger.debug(`  - new: ${abs}`);
			const childLog = wrapLogger(this.logger, `[${basename(file, '.generator.ts')}] `);
			const gen = new CodeGenerator(this.root, abs, standalone, childLog);
			this.generators.set(abs, gen);
		}

		for (const key of this.generators.keys()) {
			if (used.has(key)) continue;
			this.logger.debug(`  - delete: ${key}`);
			this.generators.delete(key);
		}
		this.logger.log(`${this.generators.size} generator registed`);
	}

	executeAll() {
		return this.executeRelated(new Set(this.generators.keys()));
	}

	async executeRelated(trigger: ReadonlySet<string>): Promise<IResult> {
		delete this._lastResult;
		const toBeExec = [];
		for (const gen of this.generators.values()) {
			const reason = gen.shouldExecute(trigger);
			if (reason !== ExecuteReason.NoNeed) {
				toBeExec.push({ generator: gen, reason });
			}
		}

		this.logger.log(`start execute: ${this.generators.size} generator registed`);

		const result = {
			count: this.generators.size,
			schedule: toBeExec.length,
			success: 0,
			skip: 0,
			errors: [] as Error[],
			watchFiles: [] as string[],
		} satisfies IResult;

		await new PromisePool()
			.withConcurrency(4)
			.for(toBeExec)
			.onTaskStarted(({ generator, reason }) => {
				generator.logger.verbose(`task started (${ExecuteReason[reason]}).`);
			})
			.handleError((err, { generator }) => {
				generator.logger.verbose(`task errored.`);
				result.errors.push(err);
			})
			.onTaskFinished(({ generator }) => {
				generator.logger.verbose(`task finished.`);
			})
			.process(async ({ generator, reason }) => {
				await nextTick();
				const gr = await generator.compileRun(reason);
				if (gr.changes) {
					result.success++;
				} else {
					result.skip++;
				}
				result.watchFiles.push(...gr.userWatchFiles);
			});

		this.logger.log(
			`  code generate complete:\n    ${result.success} success, ${result.skip} unchange/skip, ${result.errors.length} error.`,
		);

		for (const gen of this.generators.values()) {
			for (const item of gen.relatedFiles) {
				if (!isAbsolute(item)) {
					throw new Error('fatal error: something returns a relative path: ' + item);
				}
			}
			result.watchFiles.push(...gen.relatedFiles);
		}

		this._lastResult = result;
		return result;
	}

	private _lastResult?: IResult;
	get watchingFiles() {
		if (this._lastResult?.watchFiles) return this._lastResult.watchFiles;

		return [...this.generators.keys()];
	}
}
