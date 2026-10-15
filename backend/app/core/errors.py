from typing import Dict, List, Optional


class AppError(Exception):
    status_code = 500

    def __init__(self, message: str, errors: Optional[Dict[str, List[str]]] = None):
        super().__init__(message)
        self.message = message
        self.errors = errors


class ValidationError(AppError):
    status_code = 400


class NotFoundError(AppError):
    status_code = 404


class ParsingError(AppError):
    status_code = 422


class AIError(AppError):
    status_code = 502


class AuthError(AppError):
    status_code = 401


class ForbiddenError(AppError):
    status_code = 403
