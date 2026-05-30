/**
 * AnkiEngine — SM-2 间隔重复算法引擎
 *
 * 职责: SM-2 调度 / 卡片 CRUD / 复习记录 / 统计 / localStorage 持久化
 *
 * 使用:
 *   const engine = new AnkiEngine();
 *   engine.generateCardsFromAnalysis(data);
 *   const due = engine.getDueCards();
 *   engine.rateCard(cardId, 3);
 *   engine.getStats();
 */
class AnkiEngine {
  constructor(storageKey = 'researchgraph_anki') {
    this.storageKey = storageKey;
    this.MAX_DEEP_DIVE_LAYERS = 2;
    this.data = this._load();
  }

  // ─── 持久化 ─────────────────────────────────────────────────

  _load() {
    // Always start fresh to avoid corrupted state issues
    localStorage.removeItem(this.storageKey);
    return { cards: [], reviews: [], deepDives: [], stats: this._freshStats() };
  }

  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[AnkiEngine] Failed to save:', e.message, 'Resetting data.');
      this.data = { cards: [], reviews: [], deepDives: [], stats: this._freshStats() };
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }
  }

  _freshStats() {
    return {
      totalReviews: 0,
      todayReviews: 0,
      streak: 0,
      lastReviewDate: null,
      masteryByLayer: { 0: 0, 1: 0, 2: 0 },
      deepDiveCount: 0,
      conceptMastery: {}
    };
  }

  // ─── SM-2 算法 ──────────────────────────────────────────────

  /**
   * SM-2 调度计算
   * @param {number} rating — 用户自评 0-5 (0=完全忘记, 5=完美回忆)
   * @param {number} prevInterval — 上次间隔（天）
   * @param {number} prevEF — 当前 ease factor
   * @param {number} prevReps — 连续正确次数
   * @returns {{ interval: number, easeFactor: number, repetitions: number }}
   */
  _sm2(rating, prevInterval = 0, prevEF = 2.5, prevReps = 0) {
    let ef = prevEF;
    let reps = prevReps;
    let interval;

    if (rating < 3) {
      // 忘记: 重置
      reps = 0;
      interval = 1;
    } else {
      reps += 1;
      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.round(prevInterval * ef);
      }
    }

    // 更新 ease factor
    ef = ef + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    if (ef < 1.3) ef = 1.3;

    return { interval, easeFactor: Math.round(ef * 100) / 100, repetitions: reps };
  }

  // ─── 卡片生成 ───────────────────────────────────────────────

  /**
   * 从分析结果自动生成初始卡片 (Layer 0)
   * @param {Object} data — { concepts, relationships, agentReport }
   * @returns {string[]} 生成的卡片 ID 列表
   */
  generateCardsFromAnalysis(data) {
    const newCardIds = [];
    if (!data) return newCardIds;

    // 概念定义卡
    if (Array.isArray(data.concepts)) {
      for (const c of data.concepts) {
        const card = this._createCard({
          front: `什么是「${c.name}」？`,
          back: c.definition || '未提供定义。',
          sourceType: 'concept',
          sourceId: c.id,
          layer: 0,
          metadata: { importance: c.importance, category: c.category }
        });
        newCardIds.push(card.id);
      }
    }

    // 关系卡
    if (Array.isArray(data.relationships)) {
      for (const r of data.relationships) {
        const sourceName = this._findConceptName(data.concepts, r.source) || r.source;
        const targetName = this._findConceptName(data.concepts, r.target) || r.target;
        const card = this._createCard({
          front: `「${sourceName}」与「${targetName}」有什么关系？`,
          back: `${sourceName} ${r.relationship} ${targetName}。${r.description ? ' ' + r.description : ''}`,
          sourceType: 'relationship',
          sourceId: r.source + '_' + r.target,
          layer: 0,
          metadata: { relationship: r.relationship }
        });
        newCardIds.push(card.id);
      }
    }

    // 知识缺口卡
    if (data.agentReport && Array.isArray(data.agentReport.gaps)) {
      for (let i = 0; i < data.agentReport.gaps.length; i++) {
        const gap = data.agentReport.gaps[i];
        const action = data.agentReport.actions?.[i] || '查阅相关资料补全此知识缺口。';
        const card = this._createCard({
          front: `知识缺口: ${gap}`,
          back: `行动建议: ${action}`,
          sourceType: 'gap',
          sourceId: 'gap_' + i,
          layer: 0
        });
        newCardIds.push(card.id);
      }
    }

    this._save();
    return newCardIds;
  }

  /**
   * 从加深分析结果生成深层卡片 (Layer N)
   * @param {Object} result — 加深分析 AI 返回结果
   * @param {string} conceptName — 原概念名
   * @param {number} layer — 目标层数
   * @returns {string[]} 生成的卡片 ID 列表
   */
  generateDeepDiveCards(result, conceptName, layer) {
    const newCardIds = [];

    // 子概念卡
    if (Array.isArray(result.subConcepts)) {
      for (const sc of result.subConcepts) {
        const front = `「${conceptName}」的子概念: ${sc.name}`;
        const back = sc.definition || '';
        const example = sc.example ? `\n例子: ${sc.example}` : '';
        const card = this._createCard({
          front, back: back + example,
          sourceType: 'subconcept', sourceId: `${conceptName}_${sc.name}`,
          layer, metadata: { parentConcept: conceptName, subName: sc.name }
        });
        newCardIds.push(card.id);
      }
    }

    // 类比卡
    if (result.analogy) {
      const card = this._createCard({
        front: `「${conceptName}」可以类比成什么？`,
        back: result.analogy,
        sourceType: 'analogy', sourceId: `${conceptName}_analogy`,
        layer, metadata: { parentConcept: conceptName }
      });
      newCardIds.push(card.id);
    }

    // 预修知识卡
    if (Array.isArray(result.prerequisites)) {
      for (let i = 0; i < result.prerequisites.length; i++) {
        const card = this._createCard({
          front: `要理解「${conceptName}」，需要先知道什么？`,
          back: result.prerequisites[i],
          sourceType: 'prerequisite', sourceId: `${conceptName}_prereq_${i}`,
          layer, metadata: { parentConcept: conceptName }
        });
        newCardIds.push(card.id);
      }
    }

    // 对比辨析卡
    if (Array.isArray(result.contrasts)) {
      for (const ct of result.contrasts) {
        const card = this._createCard({
          front: `「${conceptName}」与「${ct.otherConcept}」有何区别？`,
          back: ct.difference || `${conceptName} 与 ${ct.otherConcept} 不同: 需要补充对比信息。`,
          sourceType: 'contrast', sourceId: `${conceptName}_vs_${ct.otherConcept}`,
          layer, metadata: { parentConcept: conceptName, otherConcept: ct.otherConcept }
        });
        newCardIds.push(card.id);
      }
    }

    // 应用场景卡 (Layer >= 2)
    if (Array.isArray(result.applicationScenarios)) {
      for (let i = 0; i < result.applicationScenarios.length; i++) {
        const card = this._createCard({
          front: `「${conceptName}」的应用场景 ${i + 1}`,
          back: result.applicationScenarios[i],
          sourceType: 'application', sourceId: `${conceptName}_app_${i}`,
          layer, metadata: { parentConcept: conceptName }
        });
        newCardIds.push(card.id);
      }
    }

    // 论证链卡 (Layer >= 2)
    if (Array.isArray(result.argumentChain)) {
      const card = this._createCard({
        front: `「${conceptName}」的完整论证链是什么？`,
        back: result.argumentChain.join('\n→ '),
        sourceType: 'argumentChain', sourceId: `${conceptName}_chain`,
        layer, metadata: { parentConcept: conceptName }
      });
      newCardIds.push(card.id);
    }

    this._save();
    return newCardIds;
  }

  _createCard({ front, back, sourceType, sourceId, layer = 0, metadata = {} }) {
    const id = 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    // 避免重复
    const existing = this.data.cards.find(c =>
      c.front === front && c.sourceType === sourceType && c.layer === layer
    );
    if (existing) return existing;

    const card = {
      id, front, back, sourceType, sourceId, layer,
      parentCardId: null,
      easeFactor: 2.5, interval: 0, repetitions: 0,
      nextReviewDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      lastRating: null,
      metadata
    };
    this.data.cards.push(card);
    return card;
  }

  _findConceptName(concepts, id) {
    if (!Array.isArray(concepts)) return null;
    const c = concepts.find(c => c.id === id);
    return c ? c.name : null;
  }

  // ─── 卡片查询 ───────────────────────────────────────────────

  /** 获取今日待复习卡片 */
  getDueCards() {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.cards
      .filter(c => c.nextReviewDate <= today)
      .sort((a, b) => a.interval - b.interval || a.layer - b.layer);
  }

  /** 获取所有卡片（按 layer 分组） */
  getCardsByLayer() {
    const groups = {};
    for (const card of this.data.cards) {
      const key = card.layer;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
    return groups;
  }

  /** 获取某概念相关的所有卡片（用于知识树） */
  getCardsByConcept(conceptName) {
    return this.data.cards.filter(c =>
      c.front.includes(conceptName) ||
      c.metadata?.parentConcept === conceptName
    );
  }

  /**
   * 根据概念名获取掌握度颜色和状态
   * @param {string} conceptName
   * @returns {{ color: string, mastery: string, borderColor: string }}
   */
  getConceptMastery(conceptName) {
    const cm = this.data.stats.conceptMastery[conceptName];
    if (!cm || cm.ratings.length === 0) return null;
    const avg = cm.avgRating || 0;
    const card = this.data.cards.find(c =>
      c.front.includes(conceptName) || c.metadata?.parentConcept === conceptName
    );
    if (!card) return null;
    if (avg >= 4) return { color: '#22c55e', mastery: 'mastered', borderColor: '#16a34a' };
    if (avg >= 2.5) return { color: '#eab308', mastery: 'learning', borderColor: '#ca8a04' };
    return { color: '#ef4444', mastery: 'weak', borderColor: '#dc2626' };
  }

  /** 获取某概念的掌握度 */
  getConceptMasteryLegacy(conceptName) {
    return this.data.stats.conceptMastery[conceptName] || null;
  }

  // ─── 复习评分 ───────────────────────────────────────────────

  /**
   * 对卡片评分并更新 SM-2 调度
   * @param {string} cardId
   * @param {number} rating — 0-5
   * @returns {{ triggeredDeepDive: boolean, nextReviewDate: string }}
   */
  rateCard(cardId, rating) {
    const card = this.data.cards.find(c => c.id === cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);

    rating = Math.max(0, Math.min(5, Math.round(rating)));

    const { interval, easeFactor, repetitions } = this._sm2(
      rating, card.interval, card.easeFactor, card.repetitions
    );

    const today = new Date().toISOString().slice(0, 10);

    // 更新卡片
    card.interval = interval;
    card.easeFactor = easeFactor;
    card.repetitions = repetitions;
    card.lastRating = rating;
    card.nextReviewDate = this._addDays(today, interval);

    // 记录复习
    const review = {
      cardId, date: new Date().toISOString(), rating, layer: card.layer,
      triggeredDeepDive: false
    };

    // 判断是否触发加深分析
    const shouldDeepDive = rating < 3 &&
      card.layer < this.MAX_DEEP_DIVE_LAYERS &&
      (card.sourceType === 'concept' || card.sourceType === 'subconcept');

    review.triggeredDeepDive = shouldDeepDive;
    this.data.reviews.push(review);

    // 更新统计
    this._updateStats(card, rating);

    this._save();

    return {
      triggeredDeepDive: shouldDeepDive,
      nextReviewDate: card.nextReviewDate,
      card: card
    };
  }

  /** 记录加深分析 */
  recordDeepDive(originalConceptId, layer, aiResponse, generatedCardIds) {
    const record = {
      id: 'dd_' + Date.now(),
      originalConceptId,
      layer,
      triggerCardId: null,
      triggerRating: null,
      aiResponse,
      generatedCardIds,
      createdAt: new Date().toISOString()
    };
    this.data.deepDives.push(record);
    this.data.stats.deepDiveCount += 1;
    this._save();
    return record;
  }

  // ─── 统计 ───────────────────────────────────────────────────

  _updateStats(card, rating) {
    const s = this.data.stats;
    const today = new Date().toISOString().slice(0, 10);

    // 如果上次复习不是今天，重置今日计数
    if (s.lastReviewDate !== today) {
      s.todayReviews = 0;
      // 连续天数
      const yesterday = this._addDays(today, -1);
      if (s.lastReviewDate === yesterday) {
        s.streak += 1;
      } else if (s.lastReviewDate !== today) {
        s.streak = 1;
      }
    }

    s.totalReviews += 1;
    s.todayReviews += 1;
    s.lastReviewDate = today;

    // 各层掌握率: 最近 7 天评分 >= 4 的比例
    const sevenDaysAgo = this._addDays(today, -7);
    for (let layer = 0; layer <= this.MAX_DEEP_DIVE_LAYERS; layer++) {
      const layerReviews = this.data.reviews.filter(r =>
        r.layer === layer && r.date.slice(0, 10) >= sevenDaysAgo
      );
      if (layerReviews.length > 0) {
        const good = layerReviews.filter(r => r.rating >= 4).length;
        s.masteryByLayer[layer] = Math.round((good / layerReviews.length) * 100) / 100;
      }
    }

    // 概念掌握度
    if (card.sourceType === 'concept' || card.sourceType === 'subconcept') {
      const name = card.metadata?.parentConcept ||
        card.front.replace(/^什么是「/, '').replace(/」？$/, '');
      if (!s.conceptMastery[name]) {
        s.conceptMastery[name] = { layer: 0, ratings: [], lastReviewed: null };
      }
      const cm = s.conceptMastery[name];
      cm.layer = Math.max(cm.layer, card.layer);
      cm.ratings.push(rating);
      cm.avgRating = cm.ratings.reduce((a, b) => a + b, 0) / cm.ratings.length;
      cm.lastReviewed = new Date().toISOString();
    }
  }

  /** 获取复习统计摘要 */
  getStats() {
    const s = this.data.stats;
    const today = new Date().toISOString().slice(0, 10);
    const dueCards = this.data.cards.filter(c => c.nextReviewDate <= today);

    return {
      totalReviews: s.totalReviews,
      todayReviews: s.todayReviews,
      streak: s.streak,
      lastReviewDate: s.lastReviewDate,
      dueCount: dueCards.length,
      totalCards: this.data.cards.length,
      deepDiveCount: s.deepDiveCount,
      masteryByLayer: s.masteryByLayer,
      conceptMastery: s.conceptMastery,
      byLayer: {
        0: this.data.cards.filter(c => c.layer === 0).length,
        1: this.data.cards.filter(c => c.layer === 1).length,
        2: this.data.cards.filter(c => c.layer === 2).length
      }
    };
  }

  /** 获取需要加深分析的概念列表 */
  getPendingDeepDives() {
    // 检查最近复习中触发了加深但尚未执行的概念
    return this.data.reviews
      .filter(r => r.triggeredDeepDive)
      .map(r => {
        const card = this.data.cards.find(c => c.id === r.cardId);
        if (!card) return null;
        const alreadyDived = this.data.deepDives.some(d =>
          d.originalConceptId === card.sourceId && d.layer === card.layer + 1
        );
        if (alreadyDived) return null;
        return {
          cardId: card.id,
          conceptId: card.sourceId,
          conceptName: card.front.replace(/^什么是「/, '').replace(/」？$/, ''),
          layer: card.layer + 1,
          rating: r.rating
        };
      })
      .filter(Boolean);
  }

  // ─── 工具方法 ───────────────────────────────────────────────

  _addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /**
   * 从自测错题生成一张卡片，直接进入复习队列（nextReviewDate = today）
   * @param {string} conceptName
   * @param {string} definition
   * @param {string} userAnswer — 用户的错误答案
   * @returns {Object} 创建的卡片
   */
  addQuizMissCard(conceptName, definition, userAnswer = '') {
    const front = `[自测错题] 什么是「${conceptName}」？`;
    const back = `${definition}${userAnswer ? '\n\n你的答案: ' + userAnswer : ''}`;
    const existing = this.data.cards.find(c => c.front === front);
    if (existing) {
      // 已存在则重置为今天复习
      existing.nextReviewDate = new Date().toISOString().slice(0, 10);
      existing.interval = 0;
      existing.repetitions = 0;
      this._save();
      return existing;
    }
    const card = {
      id: 'quizmiss_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      front, back,
      sourceType: 'concept',
      sourceId: 'quiz_miss_' + conceptName,
      layer: 0,
      parentCardId: null,
      easeFactor: 2.5, interval: 0, repetitions: 0,
      nextReviewDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      lastRating: null,
      metadata: { fromQuiz: true, conceptName, userAnswer }
    };
    this.data.cards.push(card);
    this._save();
    return card;
  }

  /** 清除所有数据 */
  clearAll() {
    localStorage.removeItem(this.storageKey);
    this.data = this._load();
  }
}

// 浏览器环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnkiEngine };
}
