
const { By, until } = require('selenium-webdriver');
const { log } = require('./log');

async function findContactPage(driver) {
  const keywords = ['お問い合わせ', 'コンタクト', 'contact', 'inquiry'];
  const links = await driver.findElements(By.tagName('a'));
  const scoredLinks = [];

  for (const link of links) {
    const linkText = await link.getText();
    const linkUrl = await link.getAttribute('href');
    let score = 0;

    if (linkUrl) {
      const lowerLinkText = linkText.toLowerCase();
      const lowerLinkUrl = linkUrl.toLowerCase();

      for (const keyword of keywords) {
        if (lowerLinkText.includes(keyword)) {
          score += 1; // Keyword in link text
        }
        if (lowerLinkUrl.includes(keyword)) {
          score += 2; // Keyword in URL path (more important)
        }
      }
      if (score > 0) {
        scoredLinks.push({ url: linkUrl, score: score });
      }
    }
  }

  // Sort by score in descending order
  scoredLinks.sort((a, b) => b.score - a.score);

  return scoredLinks.length > 0 ? scoredLinks[0].url : null;
}

async function findFormField(driver, fieldKeywords) {
  // 1. Try to find by direct attributes on input/textarea
  const inputs = await driver.findElements(By.css('input, textarea'));
  for (const input of inputs) {
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    const placeholder = await input.getAttribute('placeholder');
    const ariaLabel = await input.getAttribute('aria-label');
    const title = await input.getAttribute('title');

    if (fieldKeywords.some(keyword => 
        (name && name.toLowerCase().includes(keyword)) ||
        (id && id.toLowerCase().includes(keyword)) ||
        (placeholder && placeholder.toLowerCase().includes(keyword)) ||
        (ariaLabel && ariaLabel.toLowerCase().includes(keyword)) ||
        (title && title.toLowerCase().includes(keyword))
    )) {
      return input;
    }
  }

  // 2. If not found, try to find by label text and its 'for' attribute
  for (const keyword of fieldKeywords) {
    try {
      // Find labels containing the keyword (case-insensitive)
      const labels = await driver.findElements(By.xpath(`//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`));
      for (const label of labels) {
        const forAttr = await label.getAttribute('for');
        if (forAttr) {
          // Try to find an input or textarea with the id from the 'for' attribute
          const fieldById = await driver.findElement(By.css(`input#${forAttr}, textarea#${forAttr}`));
          if (fieldById) {
            return fieldById;
          }
        }
      }
    } catch (e) {
      // Element not found, continue to next keyword/method
    }
  }

  return null;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeLikeHuman(element, text) {
  for (const char of text) {
    await element.sendKeys(char);
    await sleep(Math.random() * 150 + 50);
  }
}

async function handleRecaptcha(driver) {
  try {
    log('Attempting to find reCAPTCHA iframe...');
    let recaptchaFrame;
    try {
      recaptchaFrame = await driver.wait(until.elementLocated(By.css('iframe[src*="recaptcha"]')), 5000); // Try by src
    } catch (e) {
      log('reCAPTCHA iframe not found by src, trying by title...');
      recaptchaFrame = await driver.wait(until.elementLocated(By.css('iframe[title="reCAPTCHA"]')), 5000); // Try by title
    }
    log('reCAPTCHA iframe found. Attempting to interact.');
    await driver.switchTo().frame(recaptchaFrame);

    log('Attempting to find reCAPTCHA checkbox...');
    const recaptchaCheckbox = await driver.wait(until.elementLocated(By.id('recaptcha-anchor')), 10000); // Wait up to 10 seconds for checkbox
    await recaptchaCheckbox.click();
    log('Clicked reCAPTCHA checkbox. Waiting for challenge to resolve...');
    await driver.switchTo().defaultContent();
    await sleep(7000); // Increased wait time for reCAPTCHA to process
    log('reCAPTCHA interaction attempted.');
  } catch (error) {
    log(`Error interacting with reCAPTCHA: ${error.message}`);
    // If the reCAPTCHA iframe or checkbox is not found, it's not necessarily an error
    // but rather that reCAPTCHA is not present or not visible.
  }
}

async function selectDropdownOption(element, value) {
  await element.sendKeys(value);
}

async function checkCheckbox(element, checked) {
  const isSelected = await element.isSelected();
  if (checked && !isSelected) {
    await element.click();
  } else if (!checked && isSelected) {
    await element.click();
  }
}

async function selectRadioButton(elements, value) {
  for (const element of elements) {
    const elementValue = await element.getAttribute('value');
    if (elementValue === value) {
      await element.click();
      return;
    }
  }
}

async function moveMouseLikeHuman(driver, targetElement) {
  const actions = driver.actions();
  await actions.move({origin: targetElement}).perform();
  await sleep(Math.random() * 200 + 100);
}

module.exports = { findContactPage, findFormField, sleep, typeLikeHuman, handleRecaptcha, selectDropdownOption, checkCheckbox, selectRadioButton, moveMouseLikeHuman };
