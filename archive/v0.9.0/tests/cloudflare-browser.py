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


def save(page, path, button, *, status=200):
    with page.expect_response(
        lambda response: response.url.endswith(path) and response.request.method == "PUT"
    ) as saved:
        button.click()
    assert saved.value.status == status, (saved.value.status, saved.value.text())


def reload_app(page):
    with page.expect_response(
        lambda response: response.url.endswith("/api/data") and response.request.method == "GET"
    ) as synced:
        page.reload(wait_until="domcontentloaded")
    assert synced.value.ok, synced.value.status


def open_mahjong(page):
    page.locator('[data-tab="modules"]').click()
    page.get_by_role("tab", name="工具", exact=True).click()
    page.locator('[data-action="open-module"][data-key="mahjong"]').click()


def open_data_settings(page, mode):
    page.locator('[data-tab="settings"]').click()
    page.get_by_role("button", name="数据导入 / 导出", exact=True).click()
    page.locator(f'[data-action="settings-backup-view"][data-key="{mode}"]').click()


def recent_record(page, title):
    return page.locator('[data-recent-list]').get_by_text(title, exact=True)


def open_delete_confirmation(page, scope):
    toggle = page.locator('[data-record-action="toggle"]:visible')
    edit = page.locator('[data-record-action="edit"]:visible')
    delete = page.locator('[data-record-action="delete"]:visible')
    dialog = page.locator('[data-record-delete]')
    toggle.click()
    if scope == "food":
        expect(edit).not_to_be_visible()
    else:
        expect(edit).to_be_visible()
    delete.click()
    expect(dialog).to_be_visible()
    return dialog


def delete_record(page, scope, title, dismiss_confirmation=None):
    row = recent_record(page, title)
    row.click()
    dialog = open_delete_confirmation(page, scope)
    if dismiss_confirmation:
        dismiss_confirmation(dialog)
        expect(dialog).not_to_be_visible()
        expect(row).to_have_count(1)
        open_delete_confirmation(page, scope)
    save(page, f"/api/data/{scope}", dialog.locator('[data-record-delete-confirm]'))
    expect(dialog).not_to_be_visible()
    expect(row).to_have_count(0)


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
        expect(first.locator('[data-record-action="toggle"]:visible')).to_be_visible()
        first.get_by_role("button", name="我们的交集", exact=True).click()
        save(first, "/api/data/people", first.get_by_role("button", name="记一次见面", exact=True))
        expect(first.locator(".experience-summary")).to_contain_text("已记 1 次见面")
        first.get_by_role("button", name="记重要经历", exact=True).click()
        first.get_by_label("只记得大概日期", exact=True).check()
        first.get_by_label("大概日期", exact=True).fill("2022 年秋天")
        first.get_by_label("类型", exact=True).select_option("初识")
        first.get_by_label("经历内容（选填）", exact=True).fill("在书店认识")
        save(first, "/api/data/people", first.locator(".experience-form").get_by_role("button", name="保存", exact=True))
        save(first, "/api/data/people", first.get_by_role("button", name="撤回最近一次快速见面记录", exact=True))
        expect(first.locator(".experience-summary")).to_have_text("2022 年秋天相识")
        expect(first.get_by_text("在书店认识", exact=True)).to_be_visible()
        first.get_by_role("button", name="返回测试人物详情", exact=True).click()
        first.locator("[data-sheet-back]").click()

        add_record(first, "cooking")
        first.get_by_label("菜名", exact=True).fill("测试菜谱")
        first.get_by_label("食材", exact=True).fill("面条")
        first.get_by_label("火候", exact=True).fill("小火")
        first.get_by_label("做法", exact=True).fill("搅拌后加热。")
        save(first, "/api/data/cooking", first.get_by_role("button", name="保存菜谱", exact=True))
        first.get_by_role("button", name="我的烹饪", exact=True).click()
        save(first, "/api/data/cooking", first.get_by_role("button", name="次数 +1", exact=True))
        expect(first.locator(".experience-summary")).to_contain_text("做过 1 次")
        first.get_by_role("button", name="记重要烹饪", exact=True).click()
        first.get_by_label("心得（选填）", exact=True).fill("小火慢熬")
        save(first, "/api/data/cooking", first.locator(".experience-form").get_by_role("button", name="保存", exact=True))
        expect(first.locator(".experience-summary")).to_contain_text("做过 2 次")
        first.get_by_role("button", name="返回测试菜谱详情", exact=True).click()
        first.locator(".cooking-bar").get_by_role("button", name="返回最近记录", exact=True).click()

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
        histories = {record["kind"]: record.get("experiences", []) for record in backup["records"]}
        assert [(entry["date"], entry["type"], entry["note"]) for entry in histories["people"]] == [("2022 年秋天", "初识", "在书店认识")]
        assert [(entry["type"], entry["note"], entry["quick"]) for entry in histories["cooking"]] == [
            ("做了一次", "", True), ("重要烹饪", "小火慢熬", False)
        ]

        second.reload()
        open_data_settings(second, "import")
        backup["parking"]["number"] = "C33"
        second.locator("[data-backup-input]").fill(json.dumps(backup, ensure_ascii=False))
        second.get_by_role("button", name="检查备份", exact=True).click()
        save(second, "/api/data", second.get_by_role("button", name="确认导入", exact=True))
        first.reload()
        expect(first.locator("[data-widget-slot]")).to_contain_text("C33")
        recent_record(first, "测试菜谱").click()
        first.get_by_role("button", name="我的烹饪", exact=True).click()
        expect(first.locator(".experience-summary")).to_contain_text("做过 2 次")
        first.locator("summary").filter(has_text="重要烹饪").click()
        expect(first.get_by_text("小火慢熬", exact=True)).to_be_visible()
        first.get_by_role("button", name="返回测试菜谱详情", exact=True).click()
        first.get_by_role("button", name="返回最近记录", exact=True).click()

        first.locator('[data-widget-slot] [data-key="parking"]').click()
        save(first, "/api/data/parking", first.get_by_role("button", name="已取车", exact=True))
        expect(first.locator("[data-widget-slot]")).to_contain_text("记录停车")
        save(first, "/api/data/parking", first.get_by_role("button", name="撤销", exact=True))
        expect(first.locator("[data-widget-slot]")).to_contain_text("C33")

        other_food = "另一台设备新增的测试餐馆"
        original_food = recent_record(first, "测试面馆")
        original_food.click()
        conflict = open_delete_confirmation(first, "food")
        reload_app(second)
        add_record(second, "food")
        second.get_by_label("店名").fill(other_food)
        second.get_by_label("推荐菜和口味").fill("葱油拌面")
        save(second, "/api/data/food", second.get_by_role("button", name="保存记录", exact=True))
        expect(recent_record(second, other_food)).to_be_visible()

        save(first, "/api/data/food", conflict.locator('[data-record-delete-confirm]'), status=409)
        inline_error = conflict.locator('[data-record-delete-error]')
        expect(inline_error).to_be_visible()
        expect(inline_error).to_contain_text("数据已在另一台设备更新")
        expect(original_food).to_have_count(1)
        conflict.locator('[data-record-delete-cancel]').click()
        expect(conflict).not_to_be_visible()
        first.get_by_role("button", name="返回最近记录", exact=True).click()
        reload_app(first)
        expect(original_food).to_be_visible()
        expect(recent_record(first, other_food)).to_be_visible()

        delete_record(first, "food", "测试面馆", lambda dialog: dialog.locator('[data-record-delete-cancel]').click())
        delete_record(first, "people", "测试人物", lambda _: first.keyboard.press("Escape"))
        delete_record(first, "cooking", "测试菜谱")

        reload_app(second)
        for page in [first, second]:
            expect(page.locator('[data-widget-slot]')).to_contain_text("测试图书馆")
            expect(page.locator('[data-widget-slot]')).to_contain_text("C33")
            expect(recent_record(page, other_food)).to_be_visible()
            for title in ["测试面馆", "测试人物", "测试菜谱"]:
                expect(recent_record(page, title)).to_have_count(0)

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
