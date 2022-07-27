declare const window: any;
declare const EventTarget: any;
declare const Element: any;

export function isScalar(value: any): value is bigint | number | boolean | string | symbol | undefined | null | Date {
	const t = typeof value;
	switch (t) {
		case 'bigint':
		case 'number':
		case 'boolean':
		case 'string':
		case 'symbol':
		case 'undefined':
			return true;
		case 'object':
			return (
				value === null ||
				value instanceof Date ||
				value instanceof Boolean ||
				value instanceof String ||
				value instanceof Number
			);
	}
	return false;
}

export enum SerializableKind {
	Invalid = 0,
	Primitive,
	Manual,
	Other,
}

export function isSerializable(value: any): SerializableKind {
	const t = typeof value;
	switch (t) {
		case 'bigint':
		// @ts-expect-error
		case 'number':
			if (isNaN(value) || Infinity === value || -Infinity === value) {
				return SerializableKind.Invalid;
			}
		case 'boolean':
		case 'string':
		case 'undefined':
			return SerializableKind.Primitive;
		case 'object':
			if (!value) {
				return SerializableKind.Invalid;
			}
			if ('toJSON' in value || Symbol.toPrimitive in value) {
				return SerializableKind.Manual;
			}
			if (
				value instanceof Map ||
				value instanceof WeakMap ||
				value instanceof Set ||
				value instanceof WeakSet ||
				value instanceof RegExp ||
				value instanceof Promise ||
				value === Math
			) {
				return SerializableKind.Invalid;
			}
			if (typeof window === 'object') {
				if (value instanceof EventTarget) {
					return SerializableKind.Invalid;
				}
			}
			if ('then' in value && typeof value['then'] === 'function') {
				return SerializableKind.Invalid;
			}

			return SerializableKind.Other;
	}
	return SerializableKind.Invalid;
}

export function getTypeOf(value: any) {
	const t = typeof value;
	switch (t) {
		case 'bigint':
		case 'number':
		case 'boolean':
		case 'string':
		case 'symbol':
		case 'undefined':
		case 'function':
			return t;
	}
	if (value === null) return 'null';
	if (value instanceof Promise) return 'Promise';
	if (value instanceof Error) return 'Error';

	if (typeof window === 'object') {
		if (value instanceof Element) return 'DOM';
		if (value instanceof EventTarget) return 'EventTarget';
	}

	if (value instanceof String) return 'string';
	if (value instanceof Number) return 'number';
	if (value instanceof Boolean) return 'boolean';

	return 'unknown';
}

export function assertSerializable(value: any) {
	if (!value) return;

	assertSerializableWalker(value, '$');
}

function assertSerializableWalker(data: any, path: string) {
	const type = isSerializable(data);
	if (type === SerializableKind.Invalid) {
		console.error('在对象中发现不可序列化的数据: 路径为 %s, 可能的类型为: %s\n%j', path, getTypeOf(data), data);
		throw new TypeError(`对象路径 ${path} 无法序列化`);
	}

	if (type === SerializableKind.Manual || type === SerializableKind.Primitive) {
		return;
	}

	for (const [key, value] of Object.entries(data)) {
		assertSerializableWalker(value, `${path}/${key}`);
	}
}
