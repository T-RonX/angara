// import pako from 'pako';

export class StringDeflater {
  // public static inflate(string: string): string {
  //   console.log(string)
  //   const binaryString: string = atob(string);
  //   const len: number = binaryString.length;
  //   const bytes: Uint8Array = new Uint8Array(len);
  //   for (let i: number = 0; i < len; i++) {
  //     bytes[i] = binaryString.charCodeAt(i);
  //   }
  //
  //   const inflatedBytes: Uint8Array = pako.inflateRaw(bytes);
  //
  //   // Convert the inflated Uint8Array back to a string
  //   let inflatedString: string = '';
  //   for (let i: number = 0; i < inflatedBytes.length; i++) {
  //     inflatedString += String.fromCharCode(inflatedBytes[i]);
  //   }
  //
  //   return inflatedString;
  // }
}
