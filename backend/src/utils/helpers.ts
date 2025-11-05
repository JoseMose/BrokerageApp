import { APIGatewayEvent } from './types';

export interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export class ResponseBuilder {
  static success(data: any, statusCode: number = 200): APIResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        success: true,
        data,
      }),
    };
  }

  static error(message: string, statusCode: number = 400, error?: any): APIResponse {
    console.error('Error response:', { message, statusCode, error });
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && error ? { details: error } : {}),
      }),
    };
  }

  static unauthorized(message: string = 'Unauthorized'): APIResponse {
    return this.error(message, 401);
  }

  static forbidden(message: string = 'Forbidden'): APIResponse {
    return this.error(message, 403);
  }

  static notFound(message: string = 'Resource not found'): APIResponse {
    return this.error(message, 404);
  }

  static serverError(message: string = 'Internal server error', error?: any): APIResponse {
    return this.error(message, 500, error);
  }
}

export class RequestValidator {
  static parseBody<T>(event: APIGatewayEvent): T {
    if (!event.body) {
      throw new Error('Request body is required');
    }

    try {
      return JSON.parse(event.body) as T;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  static getUserId(event: APIGatewayEvent): string {
    return event.requestContext.authorizer.claims.sub;
  }

  static getUserEmail(event: APIGatewayEvent): string {
    return event.requestContext.authorizer.claims.email;
  }

  static isAdmin(event: APIGatewayEvent): boolean {
    const groups = event.requestContext.authorizer.claims['cognito:groups'];
    return groups ? groups.includes('Admins') : false;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?1?\d{10,14}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  static validateZipCode(zip: string): boolean {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zip);
  }

  static validateRequired(fields: Record<string, any>): void {
    const missing = Object.entries(fields)
      .filter(([_, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}

export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

export const isExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) < new Date();
};
