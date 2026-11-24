import json
import sys

from playwright.sync_api import expect, sync_playwright


def open_app(browser, url, password):
    page = browser.new_page(viewport={"width": 420, "height": 850})
    page.set_default_timeout(7000)
    page.goto(url)
    page.get_by_label("网站访问密码").fill(password)
    with page.expect_response(
        lambda response: response.url.endswith("/api/data")
        and response.request.method == "GET"
    ) as loaded:
        page.get_by_role("button", name="进入", exact=True).click()
    assert loaded.value.ok, loaded.value.status
    return page


def add_record(page, kind):
    page.get_by_role("button", name="新增记录", exact=True).click()
    page.locator(f'[data-action="create"][data-key="{kind}"]').click()


def save(page, path, button):
    with page.expect_response(
        lambda response: response.url.endswith(path) and response.request.method == "PUT"
    ) as saved:
        button.click()
    assert saved.value.ok, (saved.value.status, saved.value.text())


def open_mahjong(page):
    page.locator('[data-tab="modules"]').click()
    page.get_by_role("tab", name="工具", exact=True).click()
    page.locator('[data-action="open-module"][data-key="mahjong"]').click()


def open_data_settings(page, mode):
    page.locator('[data-tab="settings"]').click()
    page.get_by_role("button", name="数据导入 / 导出", exact=True).click()
    page.locator(f'[data-action="settings-backup-view"][data-key="{mode}"]').click()


def main():
    url = sys.argv[1]
    password = sys.stdin.read()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        first = open_app(browser, url, password)
        first.get_by_role("button", name="停车记录 记录停车", exact=False).click()
        first.get_by_label("停车地点").fill("测试图书馆")
        first.get_by_label("楼层和区域").fill("B2")
        first.get_by_label("车位号").fill("C32")
        save(first, "/api/data/parking", first.get_by_role("button", name="保存车位", exact=True))

        add_record(first, "food")
        first.get_by_label("店名").fill("测试面馆")
        first.get_by_label("推荐菜和口味").fill("葱油拌面")
        save(first, "/api/data/food", first.get_by_role("button", name="保存记录", exact=True))

        add_record(first, "people")
        first.get_by_label("姓名", exact=True).fill("测试人物")
        save(first, "/api/data/people", first.locator(".person-form").get_by_role("button", name="保存", exact=True))
        expect(first.locator("[data-person-edit]")).to_be_visible()
        first.locator("[data-sheet-back]").click()

        add_record(first, "cooking")
        first.get_by_label("菜名", exact=True).fill("测试菜谱")
        first.get_by_label("食材", exact=True).fill("面条")
        first.get_by_label("火候", exact=True).fill("小火")
        first.get_by_label("做法", exact=True).fill("搅拌后加热。")
        save(first, "/api/data/cooking", first.get_by_role("button", name="保存菜谱", exact=True))
        first.locator(".cooking-bar").get_by_role("button", name="返回", exact=True).click()

        open_mahjong(first)
        for score in first.locator("[data-mahjong-round] input[type=number]:enabled").all():
            score.fill("2")
        save(first, "/api/data/mahjong", first.get_by_role("button", name="记录本局", exact=True))

        second = open_app(browser, url, password)
        expect(second.locator("[data-widget-slot]")).to_contain_text("测试图书馆")
        expect(second.locator("[data-widget-slot]")).to_contain_text("C32")
        for title in ["测试面馆", "测试人物", "测试菜谱"]:
            expect(second.get_by_text(title, exact=True)).to_be_visible()
        open_mahjong(second)
        expect(second.get_by_role("heading", name="第 1 局", exact=True)).to_be_visible()
        second.locator('[data-action="back-to-category"]').click()

        open_data_settings(second, "export")
        expect(second.get_by_role("button", name="选中全部 JSON")).to_be_enabled()
        backup = json.loads(second.locator("[data-backup-output]").input_value())
        assert backup["parking"]["number"] == "C32"
        assert len(backup["mahjong"]["rounds"]) == 1
        assert {record["title"] for record in backup["records"]} == {"测试面馆", "测试人物", "测试菜谱"}

        second.reload()
        open_data_settings(second, "import")
        backup["parking"]["number"] = "C33"
        second.locator("[data-backup-input]").fill(json.dumps(backup, ensure_ascii=False))
        second.get_by_role("button", name="检查备份", exact=True).click()
        save(second, "/api/data", second.get_by_role("button", name="确认导入", exact=True))
        first.reload()
        expect(first.locator("[data-widget-slot]")).to_contain_text("C33")

        first.locator('[data-widget-slot] [data-key="parking"]').click()
        save(first, "/api/data/parking", first.get_by_role("button", name="已取车", exact=True))
        expect(first.locator("[data-widget-slot]")).to_contain_text("记录停车")
        save(first, "/api/data/parking", first.get_by_role("button", name="撤销", exact=True))
        expect(first.locator("[data-widget-slot]")).to_contain_text("C33")

        first.evaluate('''async () => {
            const fields = { time: '昨天', summary: '', detail: '' };
            const cooking = globalThis.CookingStore.createStore([]);
            await cooking.replace([
                { ...fields, kind: 'cooking', id: 'local-recipe', title: '旧菜谱' }
            ], []);
            const people = globalThis.PeopleCards;
            people.writeStore({
                records: [{ ...fields, kind: 'people', id: 'local-person', title: '旧人物' }],
                settings: people.normalizeSettings(),
                sort: 'name'
            });
            const mahjong = globalThis.MahjongCalculator.normalizeState(null);
            localStorage.setItem('m-app-mahjong-v1', JSON.stringify({ ...mahjong, rate: 2.5 }));
        }''')
        open_data_settings(first, "local")
        expect(first.get_by_role("button", name="选中全部 JSON")).to_be_enabled()
        local_backup = json.loads(first.locator("[data-backup-output]").input_value())
        assert {record["title"] for record in local_backup["records"]} == {"旧人物", "旧菜谱"}
        assert local_backup["peopleSort"] == "name"
        assert local_backup["mahjong"]["rate"] == 2.5
        assert local_backup["parking"] is None

        first.context.close()
        second.context.close()
        browser.close()


if __name__ == "__main__":
    main()
