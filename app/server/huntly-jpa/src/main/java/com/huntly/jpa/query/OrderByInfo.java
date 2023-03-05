package com.huntly.jpa.query;


import com.huntly.jpa.query.annotation.OrderBy;

import java.io.Serializable;

class OrderByInfo implements Comparable<OrderByInfo>, Serializable {

    private int priority;
    private String path;
    private OrderBy.OrderType type;

    public OrderByInfo(int priority, String path, OrderBy.OrderType type) {
        this.priority = priority;
        this.path = path;
        this.type = type;
    }

    @Override
    public int compareTo(OrderByInfo o) {
        return priority - o.priority;
    }

    public int getPriority() {
        return priority;
    }

    public void setPriority(int priority) {
        this.priority = priority;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public OrderBy.OrderType getType() {
        return type;
    }

    public void setType(OrderBy.OrderType type) {
        this.type = type;
    }
}
