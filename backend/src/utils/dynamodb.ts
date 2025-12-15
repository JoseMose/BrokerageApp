import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from './types';

const config = getConfig();
const client = new DynamoDBClient({ region: config.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export class DynamoDBService {
  static async putItem(tableName: string, item: any): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
  }

  static async getItem(tableName: string, key: any): Promise<any> {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    );
    return result.Item;
  }

  static async queryItems(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: any,
    indexName?: string,
    expressionAttributeNames?: any,
    filterExpression?: string
  ): Promise<any[]> {
    const params: any = {
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    if (indexName) {
      params.IndexName = indexName;
    }

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    const result = await docClient.send(new QueryCommand(params));
    return result.Items || [];
  }

  static async updateItem(
    tableName: string,
    key: any,
    updateExpression: string,
    expressionAttributeValues: any,
    expressionAttributeNames?: any
  ): Promise<any> {
    const params: any = {
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
  }

  static async scanItems(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: any,
    expressionAttributeNames?: any
  ): Promise<any[]> {
    const params: any = {
      TableName: tableName,
    };

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    if (expressionAttributeValues) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await docClient.send(new ScanCommand(params));
    return result.Items || [];
  }
}
