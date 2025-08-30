# Руководство по созданию коммитов с полным сообщением в Windows

## Проблема
В Windows (cmd.exe) многострочные сообщения в команде `git commit -m` обрабатываются некорректно.
Только первая строка попадает в commit message.

## Решения

### Метод 1: Использование временного файла (Рекомендуемый)
```cmd
REM Создаем файл с сообщением коммита
echo type: commit message title > commit_msg.txt
echo. >> commit_msg.txt
echo - First bullet point >> commit_msg.txt
echo - Second bullet point >> commit_msg.txt
echo - Third bullet point >> commit_msg.txt

REM Создаем коммит с полным сообщением
git commit -F commit_msg.txt

REM Очищаем временный файл
del commit_msg.txt
```

### Метод 2: Использование нескольких флагов -m
```cmd
git commit -m "type: commit message title" -m "- First bullet point" -m "- Second bullet point" -m "- Third bullet point"
```


## Формат commit message

### Основная структура
```
<type>:<space><сообщение заголовка>

<пункты с описанием изменений>
```

### Примеры типов
- `feat`: Новая функциональность
- `fix`: Исправление ошибки
- `refactor`: Рефакторинг кода
- `docs`: Изменения в документации
- `style`: Форматирование кода
- `test`: Добавление/изменение тестов
- `chore`: Служебные изменения

### Примеры commit messages

#### Правильный формат
```
refactor: simplify model access with direct getter method

- Add getModels() method to StateManager for direct access
- Update Application.js to use new getModels() method
- Update PROJECT.md to reflect new method name
```

#### Неправильный формат (только заголовок)
```
refactor: simplify model access with direct getter method
```

## Практические советы

1. **Стажируйте изменения перед коммитом:**
   ```cmd
   git add <файлы>
   git status
   ```

2. **Проверяйте commit message после создания:**
   ```cmd
   git log --oneline -1
   git log -1 --pretty=format:"%B"
   ```

3. **Используйте git commit --amend для исправления последнего коммита:**
   ```cmd
   git commit --amend -F commit_msg.txt
   ```

4. **Длина заголовка:** Не более 50 символов
5. **Пункты тела:** Краткие и информативные
6. **Язык:** Используйте английский для заголовков, русский допустим в теле

## Автоматизация
Создайте bat-файл для автоматизации процесса:

```cmd
@echo off
REM commit.bat
if "%~1"=="" (
    echo Usage: commit.bat "commit message"
    exit /b 1
)

echo %~1 > temp_commit.txt
echo. >> temp_commit.txt
echo - [Add your bullet points here] >> temp_commit.txt

git commit -F temp_commit.txt
del temp_commit.txt