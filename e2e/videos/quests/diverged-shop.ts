import { type FixtureRepo, openShop } from './quest.js';

/** main and feature/mana each have commits the other lacks, without conflict; main checked out */
export function divergedShop(repo: FixtureRepo): void {
  openShop(repo);
  repo.git('switch', '-q', '-c', 'feature/mana');
  repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
  repo.commit('feat: mana costs more', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n" });
  repo.git('switch', '-q', 'main');
  repo.commit('fix: typo in the README', { 'README.md': '# Potion shop\n\nSells potions to adventurers.\n\nOpen from dawn till dusk.\n' });
}
