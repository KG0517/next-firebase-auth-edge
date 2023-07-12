"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFirebaseAuth } from "../../auth/firebase";
import { useLoadingCallback } from "react-loading-hook";
import { getGoogleProvider, loginWithProvider } from "./firebase";
import { useAuth } from "../../auth/hooks";
import styles from "./login.module.css";
import { Button } from "../../ui/button";
import { LoadingIcon } from "../../ui/icons";

export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [hasLogged, setHasLogged] = React.useState(false);
  const { user } = useAuth();
  const { getFirebaseAuth } = useFirebaseAuth();
  const [handleLoginWithGoogle, isLoading] = useLoadingCallback(async () => {
    setHasLogged(false);
    const auth = getFirebaseAuth();
    const user = await loginWithProvider(auth, await getGoogleProvider(auth));
    const idTokenResult = await user.getIdTokenResult();
    await fetch("/api/login", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idTokenResult.token}`,
      },
    });
    setHasLogged(true);
    const redirect = params?.get("redirect");
    router.push(redirect ?? "/");
  });

  return (
    <div className={styles.page}>
      <h2>next-firebase-auth-edge example login page</h2>
      {!user && !isLoading && !hasLogged && (
        <div className={styles.info}>
          <p>
            No user found. Singing in as anonymous... <LoadingIcon />
          </p>
        </div>
      )}
      {!hasLogged && (
        <Button
          loading={isLoading}
          disabled={isLoading || !user}
          onClick={handleLoginWithGoogle}
        >
          Log in with Google
        </Button>
      )}
      {hasLogged && (
        <div className={styles.info}>
          <p>
            Redirecting to <strong>{params?.get("redirect") || "/"}</strong>{" "}
            <LoadingIcon />
          </p>
        </div>
      )}
    </div>
  );
}
