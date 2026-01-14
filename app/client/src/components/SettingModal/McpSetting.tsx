import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import { SettingControllerApiFactory } from "../../api";
import Typography from "@mui/material/Typography";
import {
    Button,
    Divider,
    TextField,
    InputAdornment,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions
} from "@mui/material";
import { useState } from "react";
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import McpToolsSection from "./McpToolsSection";

export default function McpSetting() {
    const { enqueueSnackbar } = useSnackbar();
    const api = SettingControllerApiFactory();
    const [showToken, setShowToken] = useState(false);

    // Confirmation Dialog State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        content: string;
        action: () => Promise<void>;
        buttonText: string;
        buttonColor: "primary" | "error" | "warning";
    } | null>(null);

    const {
        data: globalSetting,
        refetch
    } = useQuery(["global-setting"], async () => (await api.getGlobalSettingUsingGET()).data);

    const executeGenerateToken = async () => {
        try {
            // Generate token server-side using cryptographically secure random
            const response = await fetch('/api/setting/general/generateMcpToken', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to generate token');
            }
            await refetch();
            enqueueSnackbar('New token generated and saved.', { variant: "success" });
        } catch (err) {
            enqueueSnackbar('Failed to generate token.', { variant: "error" });
        }
    };

    const executeClearToken = async () => {
        try {
            if (globalSetting) {
                await api.saveGlobalSettingUsingPOST({
                    ...globalSetting,
                    mcpToken: ""
                });
                await refetch();
                enqueueSnackbar('Token cleared.', { variant: "info" });
            }
        } catch (err) {
            enqueueSnackbar('Failed to clear token.', { variant: "error" });
        }
    };

    const handleGenerateClick = () => {
        if (globalSetting?.mcpToken) {
            setConfirmConfig({
                title: "Reset MCP Token?",
                content: "Generating a new token will invalidate the existing one. All clients using the current token will lose access.",
                action: executeGenerateToken,
                buttonText: "Reset Token",
                buttonColor: "warning"
            });
            setConfirmOpen(true);
        } else {
            // If no token exists, just generate without confirmation
            executeGenerateToken();
        }
    };

    const handleClearClick = () => {
        setConfirmConfig({
            title: "Clear MCP Token?",
            content: "Clearing the token will disable MCP access. All clients will be disconnected.",
            action: executeClearToken,
            buttonText: "Clear Token",
            buttonColor: "error"
        });
        setConfirmOpen(true);
    };

    const handleConfirm = async () => {
        if (confirmConfig) {
            await confirmConfig.action();
        }
        setConfirmOpen(false);
    };

    const handleCopyToken = () => {
        if (globalSetting?.mcpToken) {
            navigator.clipboard.writeText(globalSetting.mcpToken);
            enqueueSnackbar('Token copied to clipboard', { variant: 'success' });
        }
    };

    const getMaskedToken = (token: string | undefined) => {
        if (!token) return "";
        return token.substring(0, 10) + "*".repeat(token.length - 10);
    };

    return (
        <div>
            <Typography variant={'h6'} className={''}>
                MCP Server
            </Typography>
            <Divider />

            <div className={'mt-4'}>
                <div className={'flex items-start gap-4 flex-col'}>
                    <div className="w-full flex items-center gap-2">
                        <TextField
                            margin="dense"
                            size={"small"}
                            fullWidth={true}
                            id="mcpToken"
                            label="MCP Token"
                            value={showToken ? (globalSetting?.mcpToken || "") : getMaskedToken(globalSetting?.mcpToken)}
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle token visibility"
                                            onClick={() => setShowToken(!showToken)}
                                            edge="end"
                                        >
                                            {showToken ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                            variant="outlined"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={handleGenerateClick}
                        >
                            {globalSetting?.mcpToken ? 'Reset Token' : 'Generate Token'}
                        </Button>
                        <Button
                            variant="outlined"
                            disabled={!globalSetting?.mcpToken}
                            onClick={handleCopyToken}
                        >
                            Copy Token
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            disabled={!globalSetting?.mcpToken}
                            onClick={handleClearClick}
                        >
                            Clear Token
                        </Button>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <Typography variant="subtitle2" className="font-bold mb-2">
                        How to configure
                    </Typography>
                    <div className="text-sm text-gray-600 space-y-4">
                        <div>
                            <p className="font-semibold mb-1">1. Endpoint URL:</p>
                            <code className="bg-white px-2 py-1 rounded border border-gray-200 select-all block w-full overflow-x-auto whitespace-nowrap">
                                {window.location.origin}/api/mcp/sse
                            </code>
                        </div>

                        <Divider className="border-dashed" />

                        <div>
                            <p className="font-semibold mb-1">Claude Code (Project):</p>
                            <pre className="bg-slate-800 text-slate-200 p-3 rounded overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all">
                                {`claude mcp add --transport sse huntly ${window.location.origin}/api/mcp/sse --header "Authorization: Bearer YOUR_TOKEN"`}
                            </pre>
                        </div>

                        <div>
                            <p className="font-semibold mb-1">Claude Code (Global):</p>
                            <pre className="bg-slate-800 text-slate-200 p-3 rounded overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all">
                                {`claude mcp add --transport sse -s user huntly ${window.location.origin}/api/mcp/sse --header "Authorization: Bearer YOUR_TOKEN"`}
                            </pre>
                        </div>

                        <div>
                            <p className="font-semibold mb-1">Cursor / Windsurf / Trae (JSON Config):</p>
                            <pre className="bg-white p-3 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
                                {JSON.stringify({
                                    "mcpServers": {
                                        "huntly": {
                                            "type": "sse",
                                            "url": `${window.location.origin}/api/mcp/sse`,
                                            "headers": {
                                                "Authorization": "Bearer YOUR_TOKEN"
                                            }
                                        }
                                    }
                                }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* MCP Tools Section */}
                <McpToolsSection />
            </div>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <DialogTitle id="confirm-dialog-title">
                    {confirmConfig?.title}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="confirm-dialog-description">
                        {confirmConfig?.content}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} color={confirmConfig?.buttonColor} autoFocus>
                        {confirmConfig?.buttonText}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
