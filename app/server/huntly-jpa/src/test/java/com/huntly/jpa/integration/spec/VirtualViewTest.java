/**
 * Copyright © 2019, Wen Hao <wenhao@126.com>.
 * <p>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * <p>
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * <p>
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package com.huntly.jpa.integration.spec;

import com.huntly.jpa.spec.Specifications;
import com.huntly.jpa.builder.PersonBuilder;
import com.huntly.jpa.model.Person;
import com.huntly.jpa.model.PersonIdCard;
import com.huntly.jpa.repository.PersonIdCardRepository;
import com.huntly.jpa.repository.PersonRepository;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

@DataJpaTest
public class VirtualViewTest {
    @Autowired
    private PersonRepository personRepository;
    @Autowired
    private PersonIdCardRepository personIdCardRepository;
    @Autowired
    private TestEntityManager entityManager;

    @Test
    public void should_be_able_to_query_from_virtual_view() {
        // given
        Person jack = new PersonBuilder()
                .name("Jack")
                .age(18)
                .idCard("100000000000000000")
                .build();
        Person eric = new PersonBuilder()
                .name("Eric")
                .age(20)
                .idCard("200000000000000000")
                .build();
        Person jackson = new PersonBuilder()
                .age(30)
                .nickName("Jackson")
                .idCard("300000000000000000")
                .build();
        personRepository.save(jack);
        personRepository.save(eric);
        personRepository.save(jackson);
        entityManager.flush();

        // when
        Specification<PersonIdCard> specification = Specifications.<PersonIdCard>and()
                .gt("age", 18)
                .build();
        List<PersonIdCard> personIdCards = personIdCardRepository.findAll(specification);

        // then
        assertThat(personIdCards.size()).isEqualTo(2);
    }
}
