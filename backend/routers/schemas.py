from typing import Optional
from pydantic import BaseModel


class LoginBody(BaseModel):
    login: str
    password: str


class AdminGenerateReportBody(BaseModel):
    report_type: str


class UpdateLastVisitBody(BaseModel):
    userId: int
    lastVisit: str


class CreateUserBody(BaseModel):
    name: str
    login: str
    password: str
    id_organization: int = 1
    id_duty: int = 1


class UpdateUserBody(BaseModel):
    name:            Optional[str] = None
    login:           Optional[str] = None
    password:        Optional[str] = None
    id_organization: Optional[int] = None
    id_duty:         Optional[int] = None
