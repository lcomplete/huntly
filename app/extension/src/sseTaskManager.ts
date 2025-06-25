import { getApiBaseUrl } from "./services";
/**
 * Interface for a single SSE task
 */
export interface SSETask {
  taskId: string;
  tabId: number;
  abortController: AbortController;
  isActive: boolean;
  shortcutId: number;
  shortcutName: string;
}

/**
 * SSE Request Manager class to handle multiple streaming requests with state management
 */
export class SSERequestManager {
  private tasks: Map<string, SSETask> = new Map();
  
  constructor() {}
  
  /**
   * Get all active tasks
   */
  public getActiveTasks(): SSETask[] {
    return Array.from(this.tasks.values()).filter(task => task.isActive);
  }
  
  /**
   * Get task by taskId
   */
  public getTask(taskId: string): SSETask | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * Get tasks by tabId
   */
  public getTasksByTabId(tabId: number): SSETask[] {
    return Array.from(this.tasks.values()).filter(task => task.tabId === tabId && task.isActive);
  }
  
  /**
   * Check if a task is currently active
   */
  public isTaskActive(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    return task ? task.isActive : false;
  }
  
  /**
   * Cancel a specific task by taskId
   */
  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.isActive) {
      console.debug('[SSE] Cancelling task:', taskId);
      task.abortController.abort();
      this.cleanupTask(taskId);
      return true;
    }
    return false;
  }
  
  /**
   * Cancel all tasks for a specific tab
   */
  public cancelTasksByTabId(tabId: number): number {
    const tasksToCancel = this.getTasksByTabId(tabId);
    let cancelledCount = 0;
    
    tasksToCancel.forEach(task => {
      if (this.cancelTask(task.taskId)) {
        cancelledCount++;
      }
    });
    
    console.debug(`[SSE] Cancelled ${cancelledCount} tasks for tab ${tabId}`);
    return cancelledCount;
  }
  
  /**
   * Cancel all active tasks
   */
  public cancelAllTasks(): number {
    const activeTasks = this.getActiveTasks();
    let cancelledCount = 0;
    
    activeTasks.forEach(task => {
      if (this.cancelTask(task.taskId)) {
        cancelledCount++;
      }
    });
    
    console.debug(`[SSE] Cancelled ${cancelledCount} tasks`);
    return cancelledCount;
  }
  
  /**
   * Clean up a completed or cancelled task
   */
  private cleanupTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.isActive = false;
      // Keep the task record for a short time for debugging purposes
      setTimeout(() => {
        this.tasks.delete(taskId);
      }, 10000); // Clean up after 10 seconds
    }
  }
  
  /**
   * Process article content with a shortcut using streaming response
   * @param taskId Unique identifier for this task
   * @param tabId The tab ID where this task is running
   * @param content The article content to process
   * @param shortcutId The ID of the shortcut to use
   * @param shortcutName The name of the shortcut
   * @param baseUri Optional base URI for HTML cleaning
   * @param title Optional title to include in the processing
   * @param onData Callback function to handle streaming data
   * @param onEnd Callback function to handle completion
   * @param onError Callback function to handle errors
   */
  public async processContentWithShortcutStream(
    taskId: string,
    tabId: number,
    content: string,
    shortcutId: number,
    shortcutName: string,
    baseUri: string = "",
    title: string = "",
    onData: (data: string, taskId: string) => void,
    onEnd: (taskId: string) => void,
    onError: (error: any, taskId: string) => void
  ): Promise<void> {
    // Cancel any existing task for the same tab (single task per tab)
    this.cancelTasksByTabId(tabId);
    
    // Create new task
    const abortController = new AbortController();
    const task: SSETask = {
      taskId,
      tabId,
      abortController,
      isActive: true,
      shortcutId,
      shortcutName
    };
    
    this.tasks.set(taskId, task);
    
    const apiBaseUri = await getApiBaseUrl();
    if (!apiBaseUri) {
      onError(new Error("API base URL not configured"), taskId);
      this.cleanupTask(taskId);
      return;
    }
    
    // Safety mechanism: force timeout after 5 minutes
    const timeoutId = setTimeout(() => {
      if (this.isTaskActive(taskId)) {
        console.warn('[SSE] Force timeout after 5 minutes for task:', taskId);
        this.cancelTask(taskId);
        onError(new Error("Request timeout"), taskId);
      }
    }, 5 * 60 * 1000);
    
    try {
      console.debug('[SSE] Starting streaming request for shortcut:', shortcutId, 'task:', taskId, 'tab:', tabId);
      
      const response = await fetch(`${apiBaseUri}page/processContentWithShortcut`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          content,
          shortcutId,
          baseUri,
          title,
          mode: 'fast'
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body available");
      }

      await this.processStreamResponse(
        response.body, 
        taskId,
        onData, 
        onEnd, 
        onError
      );
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.debug('[SSE] Request aborted for task:', taskId);
      } else {
        console.error('[SSE] Error in streaming request for task:', taskId, error);
        onError(error, taskId);
      }
    } finally {
      clearTimeout(timeoutId);
      if (this.isTaskActive(taskId)) {
        this.cleanupTask(taskId);
      }
    }
  }
  
  private async processStreamResponse(
    body: ReadableStream<Uint8Array>,
    taskId: string,
    onData: (data: string, taskId: string) => void,
    onEnd: (taskId: string) => void,
    onError: (error: any, taskId: string) => void
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let iterations = 0;
    const maxIterations = 200000; // 20万次迭代限制
    const maxBufferSize = 10 * 1024 * 1024; // 10MB 缓冲区限制

    try {
      while (true) {
        // Check if this task is still active
        if (!this.isTaskActive(taskId)) {
          console.debug('[SSE] Task cancelled, stopping stream processing:', taskId);
          break;
        }
        
        // Safety checks
        if (++iterations > maxIterations) {
          throw new Error("Maximum iterations exceeded - potential infinite loop");
        }
        
        if (buffer.length > maxBufferSize) {
          throw new Error("Buffer size exceeded - potential memory leak");
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          console.debug('[SSE] Stream completed for task:', taskId);
          onEnd(taskId);
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        buffer = this.processSSELines(buffer, taskId, onData, onError);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        console.warn('[SSE] Error releasing reader lock:', e);
      }
    }
  }
  
  private processSSELines(
    buffer: string,
    taskId: string,
    onData: (data: string, taskId: string) => void,
    onError: (error: any, taskId: string) => void
  ): string {
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      // Check if this task is still active
      if (!this.isTaskActive(taskId)) {
        return buffer;
      }
      
      // Extract complete line (without the \n)
      let line = buffer.slice(0, newlineIndex);
      // Handle \r\n line endings
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      // Remove processed line from buffer
      buffer = buffer.slice(newlineIndex + 1);
      
      // Process the complete line
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Handle SSE format: "data: <content>" or "data:<content>"
      if (trimmedLine.startsWith('data:')) {
        const data = trimmedLine.startsWith('data: ') 
          ? trimmedLine.slice(6)  // Remove 'data: ' prefix (with space)
          : trimmedLine.slice(5); // Remove 'data:' prefix (no space)
        
        // Process the data (fast mode)
        if (data.trim()) {
          try {
            // Try to parse as JSON first (for fast mode)
            const parsedData = JSON.parse(data);
            if (typeof parsedData === 'string') {
              // Fast mode returns string content
              onData(parsedData, taskId);
            } else {
              // Other formats, pass raw data
              onData(data, taskId);
            }
          } catch (e) {
            // Not JSON, pass raw data
            onData(data, taskId);
          }
        }
      }
      // Handle error events
      else if (trimmedLine.startsWith('event: error')) {
        console.error('[SSE] Server sent error event for task:', taskId);
        onError(new Error("Server processing error"), taskId);
        return buffer; // Stop processing
      }
    }
    
    return buffer; // Return remaining incomplete lines
  }
}

// Create a global instance
export const sseRequestManager = new SSERequestManager(); 