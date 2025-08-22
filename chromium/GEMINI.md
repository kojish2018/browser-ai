# Gemini Workspace Context

This document provides context for the Gemini AI assistant to understand the project structure and conventions.

## Project Overview

This project is a Node.js application designed to automate the process of filling out and submitting contact forms on websites. It uses the Playwright library with Chromium to control a web browser, navigate to contact pages, fill in form fields, and submit the forms.

The application is configured through a `config.json` file, which specifies form data, target field keywords, and other settings.

## File Structure

- `index.js`: The main entry point of the application. It reads the configuration, launches the browser, navigates to the target URL, and orchestrates the form filling and submission process.
- `utils.js`: Contains helper functions for tasks such as human-like typing, finding the contact page, locating form fields, and submitting the form.
- `log.js`: A simple logging module to output messages to the console and a log file.
- `config.json`: The configuration file (not present by default). This file defines the form data, field mappings, user agents, and other operational parameters.
- `contact.html` & `contact-form-test.html`: Local HTML files for testing the form filling logic without accessing a live website.
- `package.json`: Defines the project's dependencies (`playwright` and `http-server`) and scripts.

## Core Logic

1.  **Configuration Loading (`index.js`)**: The application starts by loading a `config.json` file. This file is crucial for the application's operation.
2.  **Browser Launch (`index.js`)**: A Chromium browser instance is launched using Playwright. The browser is configured with a random user agent and other settings to appear more like a regular user.
3.  **Navigation (`index.js`)**: The script navigates to a URL provided as a command-line argument or to a local test file if no argument is given.
4.  **Contact Page Discovery (`utils.js`)**: If the target URL is not a direct link to a contact form, the script searches for a link containing keywords like "contact" or "お問い合わせ" and clicks it.
5.  **Form Filling (`utils.js`)**: The script identifies form fields (inputs and textareas) by matching their `name`, `id`, `placeholder`, or associated `<label>` text against keywords defined in `config.json`. It then types the corresponding data into the fields with human-like delays.
6.  **Form Submission (`utils.js`)**: The script finds a submit button based on keywords and clicks it. It also injects a script to prevent the default form submission behavior in some cases.
7.  **Logging (`log.js`)**: Throughout the process, the application logs its actions to the console and a log file.

## How to Run

The application is executed from the command line using Node.js.

**Prerequisites:**

- Node.js and npm installed.
- Project dependencies installed (`npm install`).

**Execution:**

```bash
node index.js [URL]
```

-   `[URL]` (optional): The URL of the website with the contact form. If omitted, it uses a local test file (`contact.html`).

## Key Conventions

-   **Configuration over Code**: The application's behavior is primarily controlled by the `config.json` file. Changes to form data or target websites should be made in the configuration file, not in the code.
-   **Human-like Interaction**: The `humanLikeDelay` and `humanLikeTyping` functions in `utils.js` are used to simulate human behavior and avoid detection by anti-bot mechanisms.
-   **Robust Field Discovery**: The `findField` function in `utils.js` uses multiple strategies (checking attributes, labels) to locate form fields, making it resilient to variations in form structure.
-   **Logging**: All significant actions are logged, which is essential for debugging.

This context should help Gemini understand the project's purpose, structure, and how to assist with modifications or troubleshooting.
