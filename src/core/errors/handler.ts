import { NextResponse } from 'next/server';
import { AppError } from './index';

export function handleError(error: unknown): NextResponse {
  console.error('Error occurred during request processing:', error);

  if (error instanceof AppError) {
    const responsePayload: Record<string, any> = {
      success: false,
      message: error.message,
    };

    // If it's a ValidationError, we might have nested errors
    if ('errors' in error && error.errors) {
      responsePayload.errors = (error as any).errors;
    }

    return NextResponse.json(responsePayload, { status: error.statusCode });
  }

  // Handle generic error
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status: 500 }
  );
}
