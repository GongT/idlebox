import { basename, dirname, resolve } from 'path';
import { camelCase, ucfirst } from '@idlebox/common';
import { relativePath, writeFileIfChangeSync } from '@idlebox/node';
import { IExtendParsedCommandLine } from '@idlebox/tsconfig-loader';
import { TypescriptProject } from '../api';
import { getOptions } from './load-tsconfig';
import { IFilterFunction } from './loadFilter';
import { consoleLogger, ILogger, MyError } from './logger';
import { ExportKind } from './TokenCollector';
import { idToString } from './tsapi.helpers';

export interface IOptions {
	project: string | IExtendParsedCommandLine;
	outFile: string;
	excludes: string[];
	filter?: IFilterFunction;
	logger?: ILogger;
}

export function generateIndex({ excludes, filter, outFile, project, logger }: IOptions) {
	if (excludes && !Array.isArray(excludes)) {
		throw new Error('invalid config in heft.json: excludes must be array');
	}

	let config: IExtendParsedCommandLine;
	if (typeof project === 'string') {
		config = getOptions(resolve(process.cwd(), project), true);
	} else {
		config = project;
	}

	const p = new TypescriptProject(config, logger || consoleLogger);
	const indexFileAbs = resolve(p.projectRoot, outFile);

	p.additionalIgnores.add('**/_*');
	p.additionalIgnores.add('**/_*/**');
	p.additionalIgnores.add('**/.*');
	p.additionalIgnores.add('**/.*/**');
	p.additionalIgnores.add('**/*.test.ts');
	p.additionalIgnores.add((f) => f === indexFileAbs);
	for (const ex of excludes) {
		p.additionalIgnores.add(ex);
	}

	const list = p.execute();

	if (filter) {
		filter(list);
	}

	const indexDir =
		'./' +
		relativePath(config.options.rootDir || dirname(config.options.configFilePath), dirname(outFile))
			.split('/')
			.filter((e) => e && e !== '.')
			.map(() => '..')
			.join('/');
	const header = ['// DO NOT EDIT THIS FILE', '// @ts-ignore', '/* eslint-disable */'];
	const content = [];
	for (const file of list) {
		if (file.absolutePath === indexFileAbs) {
			throw new MyError(
				'override output file: ' + indexFileAbs + ' (are you import xxx from ' + basename(indexFileAbs) + '?)'
			);
		}

		const path = importSpec(indexDir, file.relativePath);
		content.push(`/* ${file.relativePath} */`);

		if (file.identifiers) {
			content.push('\t// Identifiers');
			for (const def of file.identifiers.values()) {
				if (def.reference && !def.reference.id) {
					continue;
				}
				content.push(`\t\texport {${idToString(def.id)}} from "${path}";`);
			}
		}
		if (file.references.length) {
			content.push('\t// References');
			for (const item of file.references) {
				content.push(`\t\texport * from "${importSpec(indexDir, item.relativeFromRoot)}";`);
			}
		}
		if (file.defaultExport) {
			content.push('\t// Default');
			let id = '';
			if (file.defaultExport.id) {
				id = idToString(file.defaultExport.id);
			} else {
				id = camelCase(file.relativePath.replace(/\..+?$/, ''));
				if (file.defaultExport.kind === ExportKind.Class || file.defaultExport.kind === ExportKind.Type) {
					id = ucfirst(id);
				}
			}
			content.push(`\t\texport {default as ${id}} from "${path}";`);
		}
	}

	writeFileIfChangeSync(indexFileAbs, header.join('\n') + '\n\n' + content.join('\n'));

	return indexFileAbs;
}

function importSpec(indexDir: string, target: string) {
	return (indexDir + '/' + target.replace(/\.tsx?/, '')).replace(/\/\//g, '/').replace(/^\.\/\.\.\//, '../');
}
