'use server';

import { ServerActionState, createErrorState } from '../types';
// import { createSuccessState } from '../types'; // 現在未使用
import logger from '@/lib/logger';

export interface StreamUploadResult {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
}

export interface ChunkUploadResult {
  chunkIndex: number;
  bytesReceived: number;
  complete: boolean;
}

/**
 * ストリーミングアップロード初期化 Server Action
 */
export async function initStreamUpload(
  _prevState: ServerActionState<StreamUploadResult>,
  _formData: FormData
): Promise<ServerActionState<StreamUploadResult>> {
  try {
    // TODO: 実装
    logger.info('Stream upload initialization requested');
    return createErrorState('ストリーミングアップロードは準備中です');
  } catch (error) {
    logger.error('Init stream upload error', error);
    return createErrorState('ストリーミングアップロードの初期化に失敗しました');
  }
}

/**
 * チャンクアップロード Server Action
 */
export async function uploadChunk(
  _prevState: ServerActionState<ChunkUploadResult>,
  _formData: FormData
): Promise<ServerActionState<ChunkUploadResult>> {
  try {
    // TODO: 実装
    logger.info('Chunk upload requested');
    return createErrorState('チャンクアップロードは準備中です');
  } catch (error) {
    logger.error('Upload chunk error', error);
    return createErrorState('チャンクアップロードに失敗しました');
  }
}

/**
 * ストリーミングアップロード完了 Server Action
 */
export async function completeStreamUpload(
  _prevState: ServerActionState<void>,
  _formData: FormData
): Promise<ServerActionState<void>> {
  try {
    // TODO: 実装
    logger.info('Stream upload completion requested');
    return createErrorState('ストリーミングアップロード完了処理は準備中です');
  } catch (error) {
    logger.error('Complete stream upload error', error);
    return createErrorState('ストリーミングアップロードの完了処理に失敗しました');
  }
}

/**
 * ストリーミングアップロードキャンセル Server Action
 */
export async function cancelStreamUpload(
  _prevState: ServerActionState<void>,
  _formData: FormData
): Promise<ServerActionState<void>> {
  try {
    // TODO: 実装
    logger.info('Stream upload cancellation requested');
    return createErrorState('ストリーミングアップロードキャンセルは準備中です');
  } catch (error) {
    logger.error('Cancel stream upload error', error);
    return createErrorState('ストリーミングアップロードのキャンセルに失敗しました');
  }
}