package com.huntly.server.domain.entity;

import lombok.Data;
import org.hibernate.annotations.DynamicUpdate;

import javax.persistence.*;

/**
 * @author lcomplete
 */
@Data
@Entity
@Table(name = "page_relation")
public class PageRelation {
    @Id
    @Column(name = "page_id")
    private Long pageId;
    
    @Column(name = "page_unique_id")
    private String pageUniqueId;

    @Column(name = "page_self_thread_id")
    private String pageSelfThreadId;

    @Column(name = "page_conversation_id")
    private String pageConversationId;

    @Column(name = "page_reply_to_id")
    private String pageReplyToId;
}
