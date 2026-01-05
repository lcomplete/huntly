import { Button, Paper, CircularProgress, Typography, Box, TextField } from "@mui/material";
import React, { useEffect, useState } from "react";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { setDocTitle } from "../common/docUtils";

type AuthState = "loading" | "ready" | "authorizing" | "success" | "error";

export default function DesktopAuthorize() {
  setDocTitle("Authorize Desktop App");

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [error, setError] = useState<string>("");
  const [userCode, setUserCode] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const codeParam = params.get("code") ?? params.get("user_code");
    if (codeParam) {
      setUserCode(codeParam.trim().toUpperCase());
    }
  }, []);

  useEffect(() => {
    // Check if user is logged in
    fetch("/api/auth/loginUserInfo")
      .then((res) => res.json())
      .then((data) => {
        if (data.username) {
          setAuthState("ready");
        } else {
          // Not logged in, redirect to signin
          const currentUrl = globalThis.location.pathname + globalThis.location.search;
          globalThis.location.href = `/signin?from=${encodeURIComponent(currentUrl)}`;
        }
      })
      .catch(() => {
        const currentUrl = globalThis.location.pathname + globalThis.location.search;
        globalThis.location.href = `/signin?from=${encodeURIComponent(currentUrl)}`;
      });
  }, []);

  const handleAuthorize = async () => {
    if (!userCode.trim()) {
      setError("Please enter the code shown in the desktop app");
      return;
    }

    setAuthState("authorizing");
    setError("");

    try {
      const response = await fetch("/api/auth/desktop/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_code: userCode.trim() }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.code === 0) {
        setAuthState("success");
      } else {
        throw new Error(result.message || "Authorization failed");
      }
    } catch (e: unknown) {
      setAuthState("error");
      setError(e instanceof Error ? e.message : "Authorization failed");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAuthorize();
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-[#fafafa]">
      <Paper className="w-[480px] flex justify-center" elevation={4}>
        <div className="w-10/12 py-8">
          <div className="flex justify-center">
            <img src="/android-chrome-192x192.png" alt="Huntly" className="h-[50px] w-[50px]" />
          </div>

          <div className="flex justify-center mt-4">
            <Typography variant="h5" component="h1" className="font-bold">
              Authorize Huntly Desktop
            </Typography>
          </div>

          {authState === "loading" && (
            <Box className="flex flex-col items-center mt-8">
              <CircularProgress />
              <Typography className="mt-4" color="textSecondary">
                Checking authentication...
              </Typography>
            </Box>
          )}

          {authState === "ready" && (
            <>
              <Typography className="mt-6 text-center" color="textSecondary">
                Enter the code displayed in your Huntly desktop application to authorize sync access.
              </Typography>

              <Box className="mt-6">
                <TextField
                  fullWidth
                  label="Authorization Code"
                  placeholder="XXXX-XXXX"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  inputProps={{
                    style: { textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.2em" },
                    maxLength: 9,
                  }}
                  error={!!error}
                  helperText={error || "The code is shown in the desktop app"}
                />
              </Box>

              <Box className="mt-6 p-4 bg-gray-100 rounded">
                <Typography variant="body2" color="textSecondary">
                  This will allow the desktop app to:
                </Typography>
                <ul className="mt-2 ml-4 list-disc text-gray-600 text-sm">
                  <li>Read your saved pages and articles</li>
                  <li>Export your library to Markdown files</li>
                  <li>Sync content between devices</li>
                </ul>
              </Box>

              <Box className="mt-6">
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  onClick={handleAuthorize}
                  disabled={!userCode.trim()}
                >
                  Authorize
                </Button>
              </Box>
            </>
          )}

          {authState === "authorizing" && (
            <Box className="flex flex-col items-center mt-8">
              <CircularProgress />
              <Typography className="mt-4" color="textSecondary">
                Authorizing...
              </Typography>
            </Box>
          )}

          {authState === "success" && (
            <Box className="flex flex-col items-center mt-8">
              <CheckCircleOutlineIcon sx={{ width: 60, height: 60 }} color="success" />
              <Typography className="mt-4 text-center" color="textSecondary">
                Authorization successful!
              </Typography>
              <Typography className="mt-2 text-center text-gray-500 text-sm">
                The desktop app will connect automatically. You can close this window.
              </Typography>
            </Box>
          )}

          {authState === "error" && (
            <Box className="flex flex-col items-center mt-8">
              <ErrorOutlineIcon sx={{ width: 60, height: 60 }} color="error" />
              <Typography className="mt-4" color="error">
                {error}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                className="mt-4"
                onClick={() => {
                  setAuthState("ready");
                  setError("");
                }}
              >
                Try Again
              </Button>
            </Box>
          )}
        </div>
      </Paper>
    </div>
  );
}
