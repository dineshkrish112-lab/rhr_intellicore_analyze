package com.rhr.intellicore.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rhr.intellicore.domain.CustomDashboard;
import com.rhr.intellicore.repo.CustomDashboardRepository;
import com.rhr.intellicore.service.QueryService;
import com.rhr.intellicore.service.QueryService.QueryRequest;
import com.rhr.intellicore.service.QueryService.QueryResult;
import com.rhr.intellicore.service.ShiftService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/** User-built dashboards (tabs of widgets) and the query API their widgets run on. */
@RestController
@RequestMapping("/api")
public class CustomDashboardController {

    private static final int MAX_WIDGETS = 40;
    private static final int MAX_JSON = 200_000;

    private final CustomDashboardRepository repo;
    private final QueryService queries;
    private final ShiftService shiftService;
    private final ObjectMapper mapper;

    public CustomDashboardController(CustomDashboardRepository repo, QueryService queries, ShiftService shiftService,
                                     ObjectMapper mapper) {
        this.repo = repo;
        this.queries = queries;
        this.shiftService = shiftService;
        this.mapper = mapper;
    }

    @GetMapping("/query/catalog")
    public Map<String, Object> catalog() {
        return queries.catalog();
    }

    @PostMapping("/query")
    public QueryResult query(@RequestBody QueryRequest req) {
        return queries.run(req);
    }

    @GetMapping("/dashboards")
    public List<Map<String, Object>> list(Authentication a) {
        return repo.findByOwnerIgnoreCaseOrSharedTrueOrderByPositionAscIdAsc(a.getName()).stream()
                .map(d -> view(d, a)).toList();
    }

    @PostMapping("/dashboards")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody JsonNode body, Authentication a) {
        CustomDashboard d = new CustomDashboard();
        d.setOwner(a.getName());
        d.setPosition((int) repo.count());
        d.setCreatedAt(shiftService.now());
        apply(d, body);
        return view(repo.save(d), a);
    }

    @PutMapping("/dashboards/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody JsonNode body, Authentication a) {
        CustomDashboard d = editable(id, a);
        apply(d, body);
        return view(repo.save(d), a);
    }

    @DeleteMapping("/dashboards/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication a) {
        repo.delete(editable(id, a));
        return ResponseEntity.noContent().build();
    }

    private void apply(CustomDashboard d, JsonNode body) {
        String name = body.path("name").asText("").trim();
        if (name.isEmpty() || name.length() > 80) throw new IllegalArgumentException("Dashboard name is required (max 80 characters)");
        d.setName(name);
        d.setDescription(body.path("description").asText(null));
        d.setShared(body.path("shared").asBoolean(false));
        JsonNode widgets = body.path("widgets");
        if (widgets.isMissingNode() || widgets.isNull()) widgets = mapper.createArrayNode();
        if (!widgets.isArray()) throw new IllegalArgumentException("widgets must be a list");
        if (widgets.size() > MAX_WIDGETS) throw new IllegalArgumentException("A dashboard can hold at most " + MAX_WIDGETS + " widgets");
        String json = widgets.toString();
        if (json.length() > MAX_JSON) throw new IllegalArgumentException("Dashboard is too large");
        d.setWidgets(json);
        d.setUpdatedAt(shiftService.now());
    }

    private CustomDashboard editable(Long id, Authentication a) {
        CustomDashboard d = repo.findById(id).orElseThrow(() -> new NoSuchElementException("Dashboard not found"));
        if (!canEdit(d, a)) throw new AccessDeniedException("Only the owner can change this dashboard");
        return d;
    }

    private static boolean canEdit(CustomDashboard d, Authentication a) {
        return d.getOwner().equalsIgnoreCase(a.getName())
                || a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals("ROLE_ADMIN"));
    }

    private Map<String, Object> view(CustomDashboard d, Authentication a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("name", d.getName());
        m.put("description", d.getDescription());
        m.put("owner", d.getOwner());
        m.put("shared", d.isShared());
        m.put("editable", canEdit(d, a));
        m.put("updatedAt", d.getUpdatedAt());
        try {
            m.put("widgets", d.getWidgets() == null ? List.of() : mapper.readTree(d.getWidgets()));
        } catch (Exception e) {
            m.put("widgets", List.of());
        }
        return m;
    }
}
