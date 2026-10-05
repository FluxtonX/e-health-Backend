import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error occurred';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      message = (exceptionResponse as any).message;
    } else if (exception instanceof Error) {
      // In development or non-500, provide friendly message, sanitize PHI
      message =
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'An unexpected server error occurred'
          : exception.message;
    }

    // PHI-Safe Logging: never log request body containing health telemetry/passwords
    this.logger.error(
      `HTTP Error: ${request.method} ${request.url} - Status: ${status} - Error: ${
        exception instanceof Error ? exception.message : 'Unknown error'
      }`,
    );

    response.status(status).json({
      statusCode: status,
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
