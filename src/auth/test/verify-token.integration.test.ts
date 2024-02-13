import {
  customTokenToIdAndRefreshTokens,
  getFirebaseAuth,
  isUserNotFoundError
} from '../index';
import {v4} from 'uuid';
import {AuthError, AuthErrorCode} from '../error';
import {getAppCheck} from '../../app-check';
import {AppCheckToken} from '../../app-check/types';

const {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
  FIREBASE_AUTH_TENANT_ID,
  FIREBASE_APP_ID
} = process.env;

const TEST_SERVICE_ACCOUNT = {
  clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL!,
  privateKey: FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  projectId: FIREBASE_PROJECT_ID!
};

describe('verify token integration test', () => {
  const scenarios = [
    {
      desc: 'single-tenant',
      tenantID: undefined
    },
    {
      desc: 'multi-tenant',
      tenantId: FIREBASE_AUTH_TENANT_ID
    }
  ];
  for (const {desc, tenantId} of scenarios) {
    let appCheckToken: AppCheckToken = {token: '', ttlMillis: 0};

    beforeAll(async () => {
      const {createToken} = getAppCheck(TEST_SERVICE_ACCOUNT, tenantId);

      appCheckToken = await createToken(FIREBASE_APP_ID!);
    });

    describe(desc, () => {
      const {
        handleTokenRefresh,
        createCustomToken,
        verifyAndRefreshExpiredIdToken,
        verifyIdToken,
        deleteUser
      } = getFirebaseAuth(TEST_SERVICE_ACCOUNT, FIREBASE_API_KEY!, tenantId);

      it('should create and verify custom token', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {idToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );
        const tenant = await verifyIdToken(idToken);

        expect(tenant.uid).toEqual(userId);
        expect(tenant.customClaim).toEqual('customClaimValue');
        expect(tenant.firebase.tenant).toEqual(tenantId);
      });

      it('should throw AuthError if token is expired', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {idToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );

        return expect(() =>
          verifyIdToken(idToken, false, {
            currentDate: new Date(Date.now() + 7200 * 1000)
          })
        ).rejects.toHaveProperty('code', AuthErrorCode.TOKEN_EXPIRED);
      });

      it('should refresh token if expired', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {idToken, refreshToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );

        const result = await verifyAndRefreshExpiredIdToken(
          idToken,
          refreshToken,
          {
            currentDate: new Date(Date.now() + 7200 * 1000)
          }
        );

        expect(result?.decodedIdToken?.customClaim).toEqual('customClaimValue');
      });

      it('should verify token', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {idToken, refreshToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );
        const tokens = await verifyAndRefreshExpiredIdToken(
          idToken,
          refreshToken
        );

        expect(tokens?.decodedIdToken.uid).toEqual(userId);
        expect(tokens?.decodedIdToken.customClaim).toEqual('customClaimValue');
        expect(tokens?.decodedIdToken.firebase.tenant).toEqual(tenantId);
      });

      it('should checked revoked token', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {idToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );
        const tenant = await verifyIdToken(idToken, true);

        expect(tenant.uid).toEqual(userId);
        expect(tenant.customClaim).toEqual('customClaimValue');
        expect(tenant.firebase.tenant).toEqual(tenantId);
      });

      it('should refresh token', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {idToken, refreshToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );
        const {decodedIdToken} = await handleTokenRefresh(
          refreshToken,
          FIREBASE_API_KEY!
        );

        expect(decodedIdToken.uid).toEqual(userId);
        expect(decodedIdToken.customClaim).toEqual('customClaimValue');
        expect(decodedIdToken.token).not.toEqual(idToken);
      });

      it('should throw firebase auth error when user is not found during token refresh', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        const {refreshToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );

        await deleteUser(userId);

        return expect(() =>
          handleTokenRefresh(refreshToken, FIREBASE_API_KEY!)
        ).rejects.toEqual(new AuthError(AuthErrorCode.USER_NOT_FOUND));
      });

      it('should be able to catch "user not found" error and return null', async () => {
        const userId = v4();
        const customToken = await createCustomToken(userId, {
          customClaim: 'customClaimValue'
        });

        async function customGetToken() {
          try {
            return await handleTokenRefresh(refreshToken, FIREBASE_API_KEY!);
          } catch (e: unknown) {
            if (isUserNotFoundError(e)) {
              return null;
            }

            throw e;
          }
        }

        const {refreshToken} = await customTokenToIdAndRefreshTokens(
          customToken,
          FIREBASE_API_KEY!,
          {tenantId, appCheckToken: appCheckToken.token}
        );

        await deleteUser(userId);

        expect(await customGetToken()).toEqual(null);
      });
    });
  }
});
