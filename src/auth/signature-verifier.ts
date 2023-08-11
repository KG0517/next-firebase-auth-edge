import { isNonNullObject, isURL } from "./validator";
import { verify, VerifyOptions } from "./jwt/verify";
import {
  decodeProtectedHeader,
  JWTPayload,
  ProtectedHeaderParameters,
} from "jose";
import { useEmulator } from "./firebase";

export const ALGORITHM_RS256 = "RS256" as const;
const NO_MATCHING_KID_ERROR_MESSAGE = "no-matching-kid-error";
const NO_KID_IN_HEADER_ERROR_MESSAGE = "no-kid-in-header-error";

type PublicKeys = { [key: string]: string };

interface PublicKeysResponse {
  keys: PublicKeys;
  expiresAt: number;
}

export type DecodedToken = {
  header: ProtectedHeaderParameters;
  payload: JWTPayload;
};

export interface SignatureVerifier {
  verify(token: string, options?: VerifyOptions): Promise<void>;
}

interface KeyFetcher {
  fetchPublicKeys(): Promise<PublicKeys>;
}

function getExpiresAt(res: Response) {
  if (!res.headers.has("cache-control")) {
    return 0;
  }

  const cacheControlHeader: string = res.headers.get("cache-control")!;
  const parts = cacheControlHeader.split(",");
  const maxAge = parts.reduce((acc, part) => {
    const subParts = part.trim().split("=");
    if (subParts[0] === "max-age") {
      return +subParts[1];
    }

    return acc;
  }, 0);

  return Date.now() + maxAge * 1000;
}

const keyResponseCache: Map<string, PublicKeysResponse> = new Map();

export class UrlKeyFetcher implements KeyFetcher {
  constructor(private clientCertUrl: string) {
    if (!isURL(clientCertUrl)) {
      throw new Error(
        "The provided public client certificate URL is not a valid URL."
      );
    }
  }

  private async fetchPublicKeysResponse(url: URL): Promise<PublicKeysResponse> {
    const res = await fetch(url);

    if (!res.ok) {
      let errorMessage = "Error fetching public keys for Google certs: ";
      const data = await res.json();
      if (data.error) {
        errorMessage += `${data.error}`;
        if (data.error_description) {
          errorMessage += " (" + data.error_description + ")";
        }
      } else {
        errorMessage += `${await res.text()}`;
      }
      throw new Error(errorMessage);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(
        "Error fetching public keys for Google certs: " + data.error
      );
    }

    return {
      keys: data,
      expiresAt: getExpiresAt(res),
    };
  }

  private async fetchAndCachePublicKeys(url: URL): Promise<PublicKeys> {
    const response = await this.fetchPublicKeysResponse(url);
    keyResponseCache.set(url.toString(), response);

    return response.keys;
  }

  public async fetchPublicKeys(): Promise<PublicKeys> {
    const url = new URL(this.clientCertUrl);
    const cachedResponse = keyResponseCache.get(url.toString());

    if (!cachedResponse) {
      return this.fetchAndCachePublicKeys(url);
    }

    const { keys, expiresAt } = cachedResponse;

    if (expiresAt <= Date.now()) {
      return this.fetchAndCachePublicKeys(url);
    }

    return keys;
  }
}

export class PublicKeySignatureVerifier implements SignatureVerifier {
  constructor(private keyFetcher: KeyFetcher) {
    if (!isNonNullObject(keyFetcher)) {
      throw new Error("The provided key fetcher is not an object or null.");
    }
  }

  public static withCertificateUrl(
    clientCertUrl: string
  ): PublicKeySignatureVerifier {
    return new PublicKeySignatureVerifier(new UrlKeyFetcher(clientCertUrl));
  }

  public async verify(token: string, options?: VerifyOptions): Promise<void> {
    const header = decodeProtectedHeader(token);
    const publicKey = useEmulator()
      ? ""
      : await fetchPublicKey(this.keyFetcher, header);

    await verify(token, publicKey, options);
  }
}

export async function fetchPublicKey(
  fetcher: KeyFetcher,
  header: ProtectedHeaderParameters
): Promise<string> {
  if (!header.kid) {
    throw new Error(NO_KID_IN_HEADER_ERROR_MESSAGE);
  }

  const kid = header.kid || "";
  const publicKeys = await fetcher.fetchPublicKeys();

  if (!Object.prototype.hasOwnProperty.call(publicKeys, kid)) {
    throw new Error(NO_MATCHING_KID_ERROR_MESSAGE);
  }

  return publicKeys[kid];
}
