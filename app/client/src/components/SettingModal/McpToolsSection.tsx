import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Box,
    CircularProgress,
    Alert,
    Button,
    TextField,
    Collapse,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BuildIcon from "@mui/icons-material/Build";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { styled } from "@mui/material/styles";
import { useSnackbar } from "notistack";

const StyledAccordion = styled(Accordion)(({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    "&::before": { display: "none" },
}));

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
    backgroundColor: theme.palette.action.hover,
    "&:hover": { backgroundColor: theme.palette.action.selected },
    "& .MuiAccordionSummary-content": {
        overflow: "hidden",
        minWidth: 0,
    },
}));

const ToolNameCode = styled(Box)(({ theme }) => ({
    fontSize: "0.875rem",
    fontWeight: 600,
    fontFamily: "monospace",
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.main + "15",
    padding: "4px 8px",
    borderRadius: 4,
    whiteSpace: "nowrap",
}));

const ParamCode = styled("code")(({ theme }) => ({
    fontFamily: "monospace",
    color: theme.palette.secondary.main,
}));

const ParamRow = styled("div")(({ theme }) => ({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    borderRadius: 4,
    fontSize: "0.875rem",
}));

const CodeBlock = styled("pre")(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : "#1e293b",
    color: theme.palette.mode === "dark" ? theme.palette.grey[100] : "#e2e8f0",
    padding: theme.spacing(1.5),
    borderRadius: 4,
    overflowX: "auto",
    fontSize: "0.75rem",
    fontFamily: "monospace",
    margin: 0,
}));

interface McpToolProperty {
    type: string;
    description?: string;
    default?: unknown;
    enum?: string[];
    maximum?: number;
}

interface McpToolInputSchema {
    type: string;
    properties?: Record<string, McpToolProperty>;
    required?: string[];
}

interface McpTool {
    name: string;
    description: string;
    inputSchema: McpToolInputSchema;
}

interface ToolTestResult {
    success: boolean;
    result?: unknown;
    error?: string;
}

const fetchMcpTools = async (): Promise<McpTool[]> => {
    const response = await fetch("/api/mcp/tools");
    if (!response.ok) {
        throw new Error("Failed to fetch MCP tools");
    }
    return response.json();
};

const testMcpTool = async (name: string, args: Record<string, unknown>): Promise<ToolTestResult> => {
    const response = await fetch("/api/mcp/tools/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
    });
    return response.json();
};

interface ToolExampleRequest {
    name: string;
    arguments: Record<string, unknown>;
}

// Helper to generate date strings
const getDateString = (daysOffset: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format
};

const getToolExample = (tool: McpTool): { request: ToolExampleRequest; description: string } => {
    const args: Record<string, unknown> = {};
    const properties = tool.inputSchema.properties || {};

    Object.entries(properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
            args[key] = prop.default;
        } else if (prop.enum && prop.enum.length > 0) {
            args[key] = prop.enum[0];
        } else if (prop.type === "string") {
            // Handle date fields specially
            if (key === "start_date") {
                args[key] = getDateString(-30); // One month ago
            } else if (key === "end_date") {
                args[key] = getDateString(0); // Today
            } else if (key === "query") {
                args[key] = "example search";
            } else {
                args[key] = "example";
            }
        } else if (prop.type === "integer") {
            args[key] = prop.maximum ? Math.min(10, prop.maximum) : 10;
        } else if (prop.type === "boolean") {
            args[key] = false;
        } else if (prop.type === "array") {
            args[key] = [1, 2, 3];
        }
    });

    return {
        request: {
            name: tool.name,
            arguments: args,
        },
        description: `Call ${tool.name} tool`,
    };
};

// Tool test state for each tool
interface ToolTestState {
    inputJson: string;
    result: ToolTestResult | null;
    loading: boolean;
    showTest: boolean;
}

export default function McpToolsSection() {
    const { enqueueSnackbar } = useSnackbar();
    const [expanded, setExpanded] = useState<string | false>(false);
    const [testStates, setTestStates] = useState<Record<string, ToolTestState>>({});

    const {
        data: tools,
        isLoading,
        error,
    } = useQuery<McpTool[]>(["mcp-tools"], fetchMcpTools);

    const handleChange = (panel: string) => (_: unknown, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    const getTestState = (toolName: string, tool: McpTool): ToolTestState => {
        if (!testStates[toolName]) {
            const example = getToolExample(tool);
            return {
                inputJson: JSON.stringify(example.request.arguments, null, 2),
                result: null,
                loading: false,
                showTest: false,
            };
        }
        return testStates[toolName];
    };

    const updateTestState = (toolName: string, updates: Partial<ToolTestState>) => {
        setTestStates((prev) => ({
            ...prev,
            [toolName]: { ...prev[toolName], ...updates },
        }));
    };

    const toggleTest = (toolName: string, tool: McpTool) => {
        const current = getTestState(toolName, tool);
        if (testStates[toolName]) {
            updateTestState(toolName, { showTest: !current.showTest });
        } else {
            const example = getToolExample(tool);
            updateTestState(toolName, {
                inputJson: JSON.stringify(example.request.arguments, null, 2),
                result: null,
                loading: false,
                showTest: true,
            });
        }
    };

    const runTest = async (toolName: string) => {
        const state = testStates[toolName];
        if (!state) return;

        updateTestState(toolName, { loading: true, result: null });

        try {
            const args = JSON.parse(state.inputJson);
            const result = await testMcpTool(toolName, args);
            updateTestState(toolName, { result, loading: false });
            if (result.success) {
                enqueueSnackbar("Tool executed successfully", { variant: "success" });
            } else {
                enqueueSnackbar(`Tool error: ${result.error}`, { variant: "error" });
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "Invalid JSON";
            updateTestState(toolName, {
                result: { success: false, error: errorMsg },
                loading: false,
            });
            enqueueSnackbar(`Parse error: ${errorMsg}`, { variant: "error" });
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
                <CircularProgress size={24} />
                <Typography sx={{ ml: 1 }} color="textSecondary">
                    Loading tools...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ my: 2 }}>
                Failed to load MCP tools. Make sure the server is running.
            </Alert>
        );
    }

    if (!tools || tools.length === 0) {
        return (
            <Alert severity="info" sx={{ my: 2 }}>
                No MCP tools available.
            </Alert>
        );
    }

    return (
        <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <BuildIcon fontSize="small" />
                Available Tools ({tools.length})
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {tools.map((tool) => {
                    const properties = tool.inputSchema.properties || {};
                    const requiredParams = tool.inputSchema.required || [];
                    const testState = getTestState(tool.name, tool);

                    return (
                        <StyledAccordion
                            key={tool.name}
                            expanded={expanded === tool.name}
                            onChange={handleChange(tool.name)}
                        >
                            <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <ToolNameCode>{tool.name}</ToolNameCode>
                            </StyledAccordionSummary>
                            <AccordionDetails>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {/* Description */}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            Description
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            {tool.description}
                                        </Typography>
                                    </Box>

                                    {/* Parameters */}
                                    {Object.keys(properties).length > 0 && (
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                Parameters
                                            </Typography>
                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                                {Object.entries(properties).map(([paramName, param]) => (
                                                    <ParamRow key={paramName}>
                                                        <ParamCode>{paramName}</ParamCode>
                                                        <Chip
                                                            label={param.type}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: "0.75rem" }}
                                                        />
                                                        {requiredParams.includes(paramName) && (
                                                            <Chip
                                                                label="required"
                                                                size="small"
                                                                color="error"
                                                                variant="outlined"
                                                                sx={{ height: 20, fontSize: "0.75rem" }}
                                                            />
                                                        )}
                                                        {param.default !== undefined && (
                                                            <Chip
                                                                label={`default: ${JSON.stringify(param.default)}`}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ height: 20, fontSize: "0.75rem" }}
                                                            />
                                                        )}
                                                        {param.enum && (
                                                            <Chip
                                                                label={`enum: ${param.enum.join(", ")}`}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ height: 20, fontSize: "0.75rem" }}
                                                            />
                                                        )}
                                                        {param.description && (
                                                            <Typography
                                                                variant="body2"
                                                                color="textSecondary"
                                                                sx={{ width: "100%", mt: 0.5 }}
                                                            >
                                                                {param.description}
                                                            </Typography>
                                                        )}
                                                    </ParamRow>
                                                ))}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Test Tool Button */}
                                    <Box>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<PlayArrowIcon />}
                                            onClick={() => toggleTest(tool.name, tool)}
                                            sx={{ mb: 1 }}
                                        >
                                            {testState.showTest ? "Hide Test" : "Test Tool"}
                                        </Button>

                                        <Collapse in={testState.showTest}>
                                            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                    Arguments (JSON)
                                                </Typography>
                                                <TextField
                                                    multiline
                                                    rows={6}
                                                    fullWidth
                                                    size="small"
                                                    value={testState.inputJson}
                                                    onChange={(e) =>
                                                        updateTestState(tool.name, { inputJson: e.target.value })
                                                    }
                                                    sx={{
                                                        "& .MuiInputBase-input": {
                                                            fontFamily: "monospace",
                                                            fontSize: "0.8rem",
                                                        },
                                                    }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    onClick={() => runTest(tool.name)}
                                                    disabled={testState.loading}
                                                    startIcon={
                                                        testState.loading ? (
                                                            <CircularProgress size={16} />
                                                        ) : (
                                                            <PlayArrowIcon />
                                                        )
                                                    }
                                                    sx={{ alignSelf: "flex-start" }}
                                                >
                                                    {testState.loading ? "Running..." : "Run"}
                                                </Button>

                                                {testState.result && (
                                                    <Box sx={{ mt: 1 }}>
                                                        <Typography
                                                            variant="subtitle2"
                                                            sx={{
                                                                fontWeight: 600,
                                                                color: testState.result.success
                                                                    ? "success.main"
                                                                    : "error.main",
                                                            }}
                                                        >
                                                            {testState.result.success ? "✓ Result" : "✗ Error"}
                                                        </Typography>
                                                        <CodeBlock
                                                            style={{
                                                                maxHeight: 300,
                                                                overflowY: "auto",
                                                            }}
                                                        >
                                                            {testState.result.success
                                                                ? JSON.stringify(testState.result.result, null, 2)
                                                                : testState.result.error}
                                                        </CodeBlock>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </Box>
                                </Box>
                            </AccordionDetails>
                        </StyledAccordion>
                    );
                })}
            </Box>
        </Box>
    );
}

