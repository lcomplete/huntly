package com.huntly.jpa.integration.query;

import com.huntly.jpa.builder.PersonBuilder;
import com.huntly.jpa.integration.query.model.PersonQuery;
import com.huntly.jpa.model.Person;
import com.huntly.jpa.query.SpecificationUtils;
import com.huntly.jpa.repository.PersonRepository;
import com.huntly.jpa.spec.Specifications;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
public class QueryGreatEqualTest {
    @Autowired
    private PersonRepository personRepository;

    @Test
    public void should_be_able_to_find_by_using_great_than() {
        // given
        Person jack = new PersonBuilder()
                .name("Jack")
                .age(20)
                .build();
        Person eric = new PersonBuilder()
                .name("Eric")
                .age(18)
                .build();
        personRepository.save(jack);
        personRepository.save(eric);

        PersonQuery query=new PersonQuery();
        query.setAge(20);
        // when
//        Specification<Person> specification = Specifications.<Person>and()
//                .gt("age", 20)
//                .build();

//        List<Person> persons = personRepository.findAll(SpecificationUtils.fromQueryCriteria(query));
        List<Person> persons = personRepository.findAll(query.toSpecification());

        // then
        assertThat(persons.size()).isEqualTo(1);
    }
}
