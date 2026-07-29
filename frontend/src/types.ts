export interface User {
  id: number;
  name: string;
  organization: string;
  duty: string;
  login: string;
  is_admin: boolean;
}

export interface ScriptFilter {
  controlObject: string;
  status: string;
  problem: string;
  work: string;
}

export interface Script {
  id: string;
  controlObject: string;
  category: string;
  problem: string;
  status: string;
  work: string;
  response: string;
  documents: string;
  notes: string;
}

export interface ExcelRow {
  'ID заявки': string;
  'Объект контроля': string;
  'Категория': string;
  'Проблема': string;
  'Статус': string;
  'Работы на объекте': string;
  'Текст ответа ОИВ': string;
  'Документы/акты': string;
  'Примечания': string;
}

