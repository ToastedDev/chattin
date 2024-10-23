import type { Tab } from "@shared/types";

import { app } from "electron/main";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface Data {
  tabs: Tab[];
}

const dataPath = join(app.getPath("userData"), "data.json");

export async function getData() {
  try {
    const data = await readFile(dataPath, "utf-8");
    return JSON.parse(data);
  }
  catch {
    await writeFile(dataPath, "{}");
    return {};
  }
}

export async function setData(setter: (data: Data) => Data) {
  const newData = setter(await getData());
  await writeFile(dataPath, JSON.stringify(newData));
}
