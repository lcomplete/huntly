/** @jest-environment jsdom */

const mockCreateMCPClient = jest.fn();
const mockReadSyncStorageSettings = jest.fn();

let createAgentToolContext: typeof import("../sidepanel/agentTools")["createAgentToolContext"];

function loadAgentToolsModule() {
  jest.resetModules();
  jest.doMock("@ai-sdk/mcp", () => ({
    createMCPClient: mockCreateMCPClient,
  }));
  jest.doMock("ai", () => ({
    tool: (definition: unknown) => definition,
  }));
  jest.doMock("../storage", () => ({
    readSyncStorageSettings: mockReadSyncStorageSettings,
  }));

  const agentTools =
    require("../sidepanel/agentTools") as typeof import("../sidepanel/agentTools");
  createAgentToolContext = agentTools.createAgentToolContext;
}

describe("createAgentToolContext", () => {
  beforeEach(() => {
    mockCreateMCPClient.mockReset();
    mockReadSyncStorageSettings.mockReset();
    loadAgentToolsModule();
  });

  it("passes the abort signal to MCP tool listing and closes clients on abort", async () => {
    const controller = new AbortController();
    const close = jest.fn(async () => undefined);
    const listTools = jest.fn(async () => ({ tools: [] }));
    const toolsFromDefinitions = jest.fn(() => ({}));

    mockReadSyncStorageSettings.mockResolvedValue({
      serverUrl: "https://huntly.example",
    });
    mockCreateMCPClient.mockResolvedValue({
      close,
      listTools,
      toolsFromDefinitions,
    });

    const context = await createAgentToolContext({
      abortSignal: controller.signal,
    });

    expect(listTools).toHaveBeenCalledWith({
      options: { signal: controller.signal },
    });

    controller.abort();
    await Promise.resolve();

    expect(close).toHaveBeenCalled();

    await context.close();
  });

  it("rejects instead of falling back to local tools when aborted while loading MCP tools", async () => {
    const controller = new AbortController();
    let rejectListTools: ((error: Error) => void) | undefined;
    const close = jest.fn(async () => {
      rejectListTools?.(new Error("Connection closed"));
    });

    mockReadSyncStorageSettings.mockResolvedValue({
      serverUrl: "https://huntly.example",
    });
    mockCreateMCPClient.mockResolvedValue({
      close,
      listTools: jest.fn(
        () =>
          new Promise((_, reject) => {
            rejectListTools = reject;
          })
      ),
      toolsFromDefinitions: jest.fn(() => ({})),
    });

    const pendingContext = createAgentToolContext({
      abortSignal: controller.signal,
    });

    for (let attempt = 0; attempt < 10 && !rejectListTools; attempt += 1) {
      await Promise.resolve();
    }
    expect(rejectListTools).toBeDefined();

    controller.abort(new Error("stop requested"));

    await expect(pendingContext).rejects.toThrow(/aborted|stop requested/i);
    expect(close).toHaveBeenCalled();
  });
});
