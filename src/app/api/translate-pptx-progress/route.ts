import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

// Store active progress streams
const progressStreams = new Map<string, ReadableStreamDefaultController>();

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  
  if (!fileId) {
    return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Store controller for progress updates
      progressStreams.set(fileId, controller);
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', fileId })}\n\n`));
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`));
        } catch (error) {
          clearInterval(pingInterval);
        }
      }, 30000);
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        progressStreams.delete(fileId);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Helper function to send progress updates
export function sendProgressUpdate(fileId: string, progress: any) {
  const controller = progressStreams.get(fileId);
  if (controller) {
    try {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`)
      );
    } catch (error) {
      logger.error('Failed to send progress update:', error);
      progressStreams.delete(fileId);
    }
  }
}