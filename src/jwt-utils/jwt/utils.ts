
export function arrayBufferToBase64( buffer: ArrayBuffer ) {
  let binary = '';
  const bytes = new Uint8Array( buffer );
  const len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode( bytes[ i ] );
  }
  return btoa( binary );
}

export function stringToBase64(string: string): string {
  return btoa(string).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function objectToBase64(object: object): string {
  return stringToBase64(JSON.stringify(object));
}

type ParsedObject = { readonly [key: string]: any };
export function base64StringToObject(base64: string): ParsedObject {
  return JSON.parse(atob(base64)) as ParsedObject;
}

export function stringToArrayBuffer(value: string): ArrayBuffer {
  return new Uint8Array(
    value.split('').map((character) => character.charCodeAt(0))
  ).buffer;
}

export function base64StringToArrayBuffer(base64: string): ArrayBuffer {
  return stringToArrayBuffer(atob(base64));
}

export function pemToArrayBuffer(pem: string): ArrayBuffer {
  return base64StringToArrayBuffer(
    pem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\n/g, '')
  );
}
