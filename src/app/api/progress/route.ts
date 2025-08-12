import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

// WebSocket接続を管理するMap
const connections = new Map<string, any>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  try {
    // Server-Sent Events (SSE) を使用してリアルタイム通信を実装
    // WebSocketが使えない環境でも動作する
    const encoder = new TextEncoder();
    
    const customReadable = new ReadableStream({
      start(controller) {
        logger.info(`Progress SSE connection started for session: ${sessionId}`);
        
        // 接続情報を保存
        connections.set(sessionId, {
          controller,
          createdAt: new Date(),
          lastActivity: new Date(),
        });

        // 初期メッセージを送信
        const initialMessage = `data: ${JSON.stringify({
          type: 'connected',
          sessionId,
          timestamp: new Date().toISOString()
        })}\n\n`;
        
        controller.enqueue(encoder.encode(initialMessage));

        // ハートビート（30秒間隔）
        const heartbeat = setInterval(() => {
          try {
            const heartbeatMessage = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(encoder.encode(heartbeatMessage));
          } catch (error) {
            logger.warn(`Heartbeat failed for session ${sessionId}:`, { error });
            clearInterval(heartbeat);
          }
        }, 30000);

        // 接続情報にハートビートIDを追加
        const connection = connections.get(sessionId);
        if (connection) {
          connection.heartbeat = heartbeat;
        }
      },
      
      cancel() {
        logger.info(`Progress SSE connection closed for session: ${sessionId}`);
        const connection = connections.get(sessionId);
        if (connection?.heartbeat) {
          clearInterval(connection.heartbeat);
        }
        connections.delete(sessionId);
      }
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    logger.error('Error creating SSE connection:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, type, data } = body;

    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400 });
    }

    const connection = connections.get(sessionId);
    if (!connection) {
      return new Response('Session not found', { status: 404 });
    }

    // 進捗メッセージを送信
    const message = `data: ${JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    })}\n\n`;

    const encoder = new TextEncoder();
    connection.controller.enqueue(encoder.encode(message));
    
    // 最終活動時間を更新
    connection.lastActivity = new Date();

    logger.info(`Progress message sent to session ${sessionId}:`, { type, data });
    
    return Response.json({ success: true });

  } catch (error) {
    logger.error('Error sending progress message:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// 定期的に古い接続をクリーンアップ
setInterval(() => {
  const now = new Date();
  const maxAge = 30 * 60 * 1000; // 30分

  for (const [sessionId, connection] of connections.entries()) {
    const age = now.getTime() - connection.lastActivity.getTime();
    if (age > maxAge) {
      logger.info(`Cleaning up stale connection: ${sessionId}`);
      if (connection.heartbeat) {
        clearInterval(connection.heartbeat);
      }
      connections.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // 5分ごとにクリーンアップ