
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { log } = require('./log');
const config = require('./config.json');
const { findContactPage, findFormField, sleep, typeLikeHuman, handleRecaptcha, selectDropdownOption, checkCheckbox, selectRadioButton, moveMouseLikeHuman } = require('./utils');

(async function main() {
  // Get URL from command line arguments
  const url = process.argv[2] || config.targetUrls[0];
  if (!url) {
    log('Please provide a URL as a command-line argument.');
    return;
  }

  // Set up Chrome options
  const options = new chrome.Options();
  const userAgent = config.userAgents[Math.floor(Math.random() * config.userAgents.length)];
  options.addArguments(`--user-agent=${userAgent}`);
  options.addArguments('--disable-blink-features=AutomationControlled');

  if (config.proxy && config.proxy.enabled) {
    options.addArguments(`--proxy-server=${config.proxy.server}`);
  }

  let driver;
  try {
    // Build the WebDriver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    // Navigate to the provided URL
    await driver.get(url);
    log(`Successfully navigated to ${url}`);

    // Find form elements and fill them

    await sleep(1000);

    // Find form fields and fill them
    const contactNameField = await findFormField(driver, ['contactName', '担当者氏名', 'お名前']); // 担当者氏名に特化
    if (contactNameField) {
      await moveMouseLikeHuman(driver, contactNameField);
      await typeLikeHuman(contactNameField, config.formData.name); // config.formData.name を担当者氏名に使用
    }

    await sleep(500);

    const companyNameField = await findFormField(driver, ['company', '会社名', '団体名', 'organization']); // 会社名/団体名フィールドを追加
    if (companyNameField) {
      await moveMouseLikeHuman(driver, companyNameField);
      await typeLikeHuman(companyNameField, config.formData.companyName); // config.formData.companyName を会社名/団体名に使用
    }

    await sleep(500);

    const emailField = await findFormField(driver, ['email', 'メールアドレス']);
    if (emailField) {
      await moveMouseLikeHuman(driver, emailField);
      await typeLikeHuman(emailField, config.formData.email);
    }

    await sleep(500);

    const messageField = await findFormField(driver, ['message', 'メッセージ']);
    if (messageField) {
      await moveMouseLikeHuman(driver, messageField);
      await typeLikeHuman(messageField, config.formData.message);
    }

    // Handle dropdowns, checkboxes, and radio buttons
    if (config.formData.country) {
      try {
        const countryField = await driver.findElement(By.name('country'));
        if (countryField) await selectDropdownOption(countryField, config.formData.country);
      } catch (error) {
        if (error.name === 'NoSuchElementError') {
          log('Country dropdown not found. Skipping.');
        } else {
          throw error;
        }
      }
    }

    if (config.formData.newsletter !== undefined) {
      try {
        const newsletterCheckbox = await driver.findElement(By.name('newsletter'));
        if (newsletterCheckbox) await checkCheckbox(newsletterCheckbox, config.formData.newsletter);
      } catch (error) {
        if (error.name === 'NoSuchElementError') {
          log('Newsletter checkbox not found. Skipping.');
        } else {
          throw error;
        }
      }
    }

    if (config.formData.gender) {
      try {
        const genderRadioButtons = await driver.findElements(By.name('gender'));
        if (genderRadioButtons.length > 0) await selectRadioButton(genderRadioButtons, config.formData.gender);
      } catch (error) {
        if (error.name === 'NoSuchElementError') {
          log('Gender radio buttons not found. Skipping.');
        } else {
          throw error;
        }
      }
    }

    await sleep(1000);

    // Click the submit button
    await driver.findElement(By.css('button[type="submit"]')).click();

    await sleep(2000); // Wait for the new page to load after submission

    // Handle reCAPTCHA after submission
    await handleRecaptcha(driver);

    await sleep(3000); // Wait for 3 seconds after submission

    // Verify submission success
    const currentUrl = await driver.getCurrentUrl();
    log(`Current URL after submission: ${currentUrl}`);

    const successPatterns = [
      /送信が完了しました|送信完了|お問い合わせありがとうございます|お問い合わせを受け付けました/i, // 日本語の成功メッセージ
      /Thank you for your submission|Submission successful|Success/i, // 英語の成功メッセージ
      /完了|受付/i // より一般的なキーワード
    ];
    let submissionSuccessful = false;

    try {
      // Get the entire page body text
      const bodyText = await driver.findElement(By.tagName('body')).getText();

      for (const pattern of successPatterns) {
        if (pattern.test(bodyText)) {
          log(`Submission successful: Found pattern "${pattern.source}" on the page.`);
          submissionSuccessful = true;
          break;
        }
      }
    } catch (e) {
      log(`Error checking for success messages: ${e.message}`);
    }

    if (!submissionSuccessful) {
      log('Submission status: No explicit success message pattern found on the page.');
    }

    await driver.takeScreenshot().then(function(image, err) {
      require('fs').writeFile('./logs/screenshot_after_submission.png', image, 'base64', function(err) {
        log('Screenshot saved: ./logs/screenshot_after_submission.png');
      });
    });
    log('Form submission process completed.');

  } catch (error) {
    log(`An error occurred: ${error.message}`);
    if (error.name === 'TimeoutError') {
      log('Operation timed out.');
    } else if (error.name === 'NoSuchElementError') {
      log('Could not find an element on the page.');
    } else {
      log('An unexpected error occurred.');
    }
  } finally {
    // Quit the driver
    if (driver) {
      await driver.quit();
    }
  }
})();
