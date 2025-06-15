package com.huntly.server.domain.constant;

import com.huntly.server.domain.entity.ArticleShortcut;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * Default shortcut presets
 */
public class DefaultShortcuts {
    
    /**
     * Get the list of default shortcuts
     * @return list of default article shortcuts
     */
    public static List<ArticleShortcut> getDefaultShortcuts() {
        Instant now = Instant.now();
        
        // Create default shortcuts
        ArticleShortcut summary = new ArticleShortcut();
        summary.setName("文章摘要");
        summary.setDescription("生成文章的高质量中文摘要");
        summary.setContent("你是一个专业的文章摘要生成助手，能够生成高质量的中文摘要。请按照以下要求生成摘要：\n" +
                "1. 包含文章的主要观点和关键信息\n" +
                "2. 保持客观，不添加个人观点\n" +
                "3. 结构清晰，语言简洁\n" +
                "4. 长度尽量短，但不能太短以至于丢失重点内容，不能超过原文的一半长");
        summary.setEnabled(true);
        summary.setSortOrder(1);
        summary.setCreatedAt(now);
        summary.setUpdatedAt(now);
        
        ArticleShortcut translate = new ArticleShortcut();
        translate.setName("翻译成中文");
        translate.setDescription("将文章内容翻译成流畅的中文");
        translate.setContent("你是一个专业的翻译专家，请将以下文章翻译成流畅、自然的中文。要求：\n" +
                "1. 保持原文的意思和风格\n" +
                "2. 使用专业且地道的中文表达\n" +
                "3. 准确翻译专业术语\n" +
                "4. 保留原文的段落结构");
        translate.setEnabled(true);
        translate.setSortOrder(2);
        translate.setCreatedAt(now);
        translate.setUpdatedAt(now);
        
        ArticleShortcut keyPoints = new ArticleShortcut();
        keyPoints.setName("提取关键点");
        keyPoints.setDescription("以要点形式提取文章中的主要观点和信息");
        keyPoints.setContent("请以要点形式提取这篇文章的主要观点和关键信息：\n" +
                "1. 提取5-10个关键点，使用简洁的语言\n" +
                "2. 每个要点应该是一句完整的陈述句\n" +
                "3. 按重要性排序\n" +
                "4. 不要添加你自己的观点或解释");
        keyPoints.setEnabled(true);
        keyPoints.setSortOrder(3);
        keyPoints.setCreatedAt(now);
        keyPoints.setUpdatedAt(now);
        
        ArticleShortcut explain = new ArticleShortcut();
        explain.setName("技术解析");
        explain.setDescription("深入解释文章中的技术概念");
        explain.setContent("请深入解释这篇文章中的技术内容，要求：\n" +
                "1. 解释复杂的技术概念，使其易于理解\n" +
                "2. 提供相关背景知识\n" +
                "3. 分析技术之间的关联性\n" +
                "4. 对原文中含糊不清的部分进行澄清");
        explain.setEnabled(true);
        explain.setSortOrder(4);
        explain.setCreatedAt(now);
        explain.setUpdatedAt(now);
        
        ArticleShortcut actionItems = new ArticleShortcut();
        actionItems.setName("行动项提取");
        actionItems.setDescription("从文章中提取可执行的行动项");
        actionItems.setContent("请从这篇文章中提取可执行的行动项：\n" +
                "1. 明确指出文章中提到的所有可执行任务或建议\n" +
                "2. 使用动词开头的句子描述每个行动项\n" +
                "3. 按照执行的逻辑顺序排列\n" +
                "4. 可能的话，标注优先级（高/中/低）");
        actionItems.setEnabled(true);
        actionItems.setSortOrder(5);
        actionItems.setCreatedAt(now);
        actionItems.setUpdatedAt(now);
        
        return Arrays.asList(summary, translate, keyPoints, explain, actionItems);
    }
} 