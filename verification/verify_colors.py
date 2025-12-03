from playwright.sync_api import sync_playwright

def verify_colors():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:5173")

        # Wait for the color palette to be visible
        page.wait_for_selector(".color-palette")

        # Take a screenshot of the entire page to see the palette and canvas
        page.screenshot(path="verification/verification.png")

        # Also print out the color buttons found to verify order/names
        buttons = page.query_selector_all(".color-peg")
        print(f"Found {len(buttons)} color buttons")
        for i, btn in enumerate(buttons):
            title = btn.get_attribute("title")
            style = btn.get_attribute("style")
            print(f"Button {i}: {title} - {style}")

        browser.close()

if __name__ == "__main__":
    verify_colors()
