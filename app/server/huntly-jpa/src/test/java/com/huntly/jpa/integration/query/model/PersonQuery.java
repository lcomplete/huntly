package com.huntly.jpa.integration.query.model;

import com.huntly.jpa.model.Person;
import com.huntly.jpa.query.QueryCriteria;
import com.huntly.jpa.query.annotation.Query;
import com.huntly.jpa.query.annotation.QueryType;
import lombok.Data;

@Data
public class PersonQuery implements QueryCriteria<Person> {

    @Query(type = QueryType.GREATER_THAN_OR_EQUAL)
    private Integer age;

}
