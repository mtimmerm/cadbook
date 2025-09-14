import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface FileServerOptions {
  port?: number;
  host?: string;
  fileMaxAgeMs?: number;
}

export interface StoredFile {
  data: Buffer;
  mimeType: string;
  filename?: string;
  timestamp: number;
}

/**
 * In-memory file server for serving large binary files to Jupyter notebooks
 * without embedding them as data URLs in the notebook output.
 */
export class FileServer {
  private app: express.Application;
  private server: any;
  private files = new Map<string, StoredFile>();
  private port: number;
  private host: string;
  private isRunning = false;
  private fileMaxAgeMs: number;

  constructor(options: FileServerOptions = {}) {
    this.port = options.port ?? 0; // 0 means auto-assign
    this.host = options.host ?? 'localhost';
    this.fileMaxAgeMs = options.fileMaxAgeMs ?? (10 * 60 * 1000); // 10 minutes default
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Enable CORS for all routes
    this.app.use((req: Request, res: Response, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Serve stored files
    this.app.get('/file/:id', (req: Request, res: Response) => {
      const fileId = req.params.id;
      const file = this.files.get(fileId);
      
      if (!file) {
        res.status(404).send('File not found');
        return;
      }

      res.set('Content-Type', file.mimeType);
      // Only set Content-Disposition for files that have a filename (downloads)
      // Model-viewer URLs don't have filenames and shouldn't trigger downloads
      if (file.filename) {
        res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
      }
      res.send(file.data);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        filesStored: this.files.size,
        memoryUsage: this.getMemoryUsage()
      });
    });

  }

  /**
   * Start the server if not already running
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, this.host, () => {
        this.isRunning = true;
        const address = this.server.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
        }
        console.log(`Local file server running on http://${this.host}:${this.port}`);
        resolve();
      });

      this.server.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        console.log('CadBook file server stopped');
        resolve();
      });
    });
  }

  /**
   * Store a file in memory and return a URL to access it
   */
  storeFile(data: Buffer, mimeType: string, filename?: string): string {
    // Clean up old files before storing new one
    this.cleanupOldFiles();
    
    const id = randomUUID();
    this.files.set(id, { 
      data, 
      mimeType, 
      filename, 
      timestamp: Date.now() 
    });
    return `http://${this.host}:${this.port}/file/${id}`;
  }

  /**
   * Remove a file from memory
   */
  removeFile(url: string): boolean {
    const id = this.extractIdFromUrl(url);
    if (id) {
      return this.files.delete(id);
    }
    return false;
  }

  /**
   * Clear all stored files
   */
  clearFiles(): void {
    this.files.clear();
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): { totalBytes: number; fileCount: number } {
    let totalBytes = 0;
    for (const file of this.files.values()) {
      totalBytes += file.data.length;
    }
    return {
      totalBytes,
      fileCount: this.files.size
    };
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  private extractIdFromUrl(url: string): string | null {
    const match = url.match(/\/file\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Remove files older than the configured max age
   */
  private cleanupOldFiles(): void {
    const now = Date.now();
    const idsToDelete: string[] = [];
    
    for (const [id, file] of this.files.entries()) {
      if (now - file.timestamp > this.fileMaxAgeMs) {
        idsToDelete.push(id);
      }
    }
    
    for (const id of idsToDelete) {
      this.files.delete(id);
    }
  }
}

// Singleton instance
let globalFileServer: FileServer | null = null;

/**
 * Get or create the global file server instance
 */
export async function getFileServer(options: FileServerOptions = {}): Promise<FileServer> {
  if (!globalFileServer) {
    globalFileServer = new FileServer(options);
    await globalFileServer.start();
    
    // Cleanup on process exit
    const cleanup = async () => {
      if (globalFileServer) {
        await globalFileServer.stop();
      }
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
  
  return globalFileServer;
}

/**
 * Reset the global file server (useful for testing)
 */
export async function resetFileServer(): Promise<void> {
  if (globalFileServer) {
    await globalFileServer.stop();
    globalFileServer = null;
  }
}