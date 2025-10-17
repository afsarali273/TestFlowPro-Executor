import { Page, Locator } from '@playwright/test';

export class FlipkartHomePage {
  readonly page: Page;
  readonly searchBox: Locator;
  readonly firstProduct: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchBox = page.getByRole('textbox', { name: /search for products/i });
    // The first product link with 'Add to Compare' text nearby
    this.firstProduct = page.locator('a').filter({ hasText: 'Add to Compare' }).first();
  }

  async goto() {
    await this.page.goto('https://www.flipkart.com');
  }

  async searchForProduct(product: string) {
    await this.searchBox.fill(product);
    await this.searchBox.press('Enter');
  }

  async clickFirstSearchResult() {
    await this.firstProduct.waitFor({ state: 'visible', timeout: 10000 });
    const [productPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.firstProduct.click(),
    ]);
    await productPage.waitForLoadState();
    return productPage;
  }
}

export class FlipkartProductPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async getTitle() {
    // Product title is usually in an h1 or similar
    const title = await this.page.locator('h1, span.B_NuCI').first().textContent();
    return title?.trim() || '';
  }

  async getPrice() {
    // Price is usually in a span with class '_30jeq3 _16Jk6d' or similar
    const price = await this.page.locator('div, span').filter({ hasText: '₹' }).first().textContent();
    return price?.replace(/[^\d₹,.]/g, '').trim() || '';
  }

  async getDescription() {
    // Try to get the description by heading using XPath for following sibling
    let description = '';
    const descHeading = this.page.getByText('Description', { exact: false });
    if (await descHeading.count() > 0) {
      const descDiv = descHeading.first().locator('xpath=following-sibling::div[1]');
      if (await descDiv.count() > 0) {
        description = (await descDiv.first().textContent())?.trim() || '';
        if (description) return description;
      }
    }
    // Try 'About this item' as well
    const aboutHeading = this.page.getByText('About this item', { exact: false });
    if (await aboutHeading.count() > 0) {
      const aboutDiv = aboutHeading.first().locator('xpath=following-sibling::div[1]');
      if (await aboutDiv.count() > 0) {
        description = (await aboutDiv.first().textContent())?.trim() || '';
        if (description) return description;
      }
    }
    // Fallback: get the first large block of text
    const fallback = await this.page.locator('div._1mXcCf, div._1AN87F').first().textContent();
    return fallback?.trim() || '';
  }
}
