import { NextRequest, NextResponse } from 'next/server';

type Params = {
  params: Promise<{
    width: string;
    height: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: Params
) {
  const { width: widthParam, height: heightParam } = await params;
  const width = parseInt(widthParam) || 400;
  const height = parseInt(heightParam) || 300;
  
  // SVGプレースホルダー画像を生成
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>
      <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="16" fill="#6b7280" text-anchor="middle" dy=".3em">
        ${width} x ${height}
      </text>
    </svg>
  `;
  
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}