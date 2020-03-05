import { isWindows } from '@idlebox/common';
import { access, constants, accessSync } from 'fs';
import { PathEnvironment } from '../environment/pathEnvironment';

const windowsExecExtensions = ['.exe', '.bat', '.cmd', '.com', '.ps1'];

function exts(alterExt?: string[]) {
	if (alterExt) {
		const ret = [...alterExt];
		if (!isWindows) {
			ret.unshift('');
		}
		return ret;
	}
	if (isWindows) {
		return windowsExecExtensions;
	} else {
		return [''];
	}
}

export async function commandInPath(cmd: string, alterExt?: string[]): Promise<string | undefined> {
	const pathVar = new PathEnvironment();
	for (const item of pathVar.join(cmd)) {
		for (const ext of exts(alterExt)) {
			const found = await new Promise((resolve) => {
				access(item + ext, constants.X_OK, (e) => {
					if (e) resolve(false);
					else resolve(true);
				});
			});
			if (found) return item + ext;
		}
	}
	return undefined;
}
export function commmandInPathSync(cmd: string, alterExt?: string[]): string | undefined {
	const pathVar = new PathEnvironment();
	for (const item of pathVar.join(cmd)) {
		for (const ext of exts(alterExt)) {
			try {
				accessSync(item + ext, constants.X_OK);
				return item + ext;
			} catch {}
		}
	}
	return undefined;
}
