import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { trpc } from "../../utils/trpc";
import LoginForm from "../../components/yt2article/LoginForm";
import UrlInput from "../../components/yt2article/UrlInput";

type AppState = "loading" | "login" | "input" | "preparing";

const Yt2Article: NextPage = () => {
  const router = useRouter();
  const [state, setState] = useState<AppState>("loading");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  // tRPC queries and mutations
  const checkAuth = trpc.yt2article.checkAuth.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const getModels = trpc.yt2article.getModels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const loginMutation = trpc.yt2article.login.useMutation();
  const prepareVideoMutation = trpc.yt2article.prepareVideo.useMutation();

  // Check auth status on load
  useEffect(() => {
    if (checkAuth.isLoading) return;
    if (checkAuth.data?.authenticated) {
      setState("input");
    } else {
      setState("login");
    }
  }, [checkAuth.isLoading, checkAuth.data]);

  // Handle login
  const handleLogin = async (password: string) => {
    setLoginError(null);
    try {
      const result = await loginMutation.mutateAsync({ password });

      // Set cookie via API route
      await fetch("/api/yt2article/set-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: result.token }),
      });

      setState("input");
    } catch {
      setLoginError("Invalid password");
    }
  };

  // Handle URL submission - redirect to gen page
  const handleUrlSubmit = async (url: string, modelId: string) => {
    setPrepareError(null);
    setState("preparing");

    try {
      const data = await prepareVideoMutation.mutateAsync({ url, modelId });

      // Redirect to generation page
      void router.push(`/yt2article/gen/${data.videoId}?modelId=${encodeURIComponent(modelId)}`);
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : "Failed to process video");
      setState("input");
    }
  };

  return (
    <>
      <Head>
        <title>YT2Article - YouTube to Article</title>
        <meta name="description" content="Convert YouTube videos to articles" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 text-white">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="mb-2 text-4xl font-bold">YT2Article</h1>
            <p className="text-gray-400">Convert YouTube videos into readable articles</p>
          </div>

          {state === "loading" && <p className="text-gray-400">Loading...</p>}

          {state === "login" && (
            <LoginForm
              onLogin={handleLogin}
              isLoading={loginMutation.isPending}
              error={loginError}
            />
          )}

          {(state === "input" || state === "preparing") && getModels.data && (
            <>
              <UrlInput
                onSubmit={handleUrlSubmit}
                isLoading={state === "preparing"}
                models={getModels.data.models}
                defaultModelId={getModels.data.defaultModelId}
              />
              {prepareError && <p className="text-sm text-red-400">{prepareError}</p>}
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default Yt2Article;
